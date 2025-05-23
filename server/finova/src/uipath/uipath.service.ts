import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma, RpaActionStatus, RpaActionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as qs from 'qs';
import {Cron} from '@nestjs/schedule';

interface lineItem {
    type: string,
    management: string,
    quantity: number,
    articleCode: string,
    unitPrice: number,
    name: string,
    tva: number,
    um: string
};

export interface uiPathData{
    createdDate: string,
    dueDate: string,
    documentNumber: number,
    sellerEin?: number,
    buyerEin?: number,
    lineItems: lineItem[]
};

@Injectable()
export class UipathService {
    constructor(private prisma: PrismaService, private httpService: HttpService , private configService: ConfigService){}

    async postClientInvoice(documentId:number, userId: number, currentClientCompanyEin: string) {
        console.log(`[UiPath] Starting postClientInvoice for documentId: ${documentId}, userId: ${userId}, ein: ${currentClientCompanyEin}`);
        
        try {
            const document = await this.prisma.document.findUnique({
                where:{
                    id: documentId 
                }
            });

            if(!document) {
                console.log(`[UiPath ERROR] Document not found for ID: ${documentId}`);
                throw new NotFoundException('Document to process not found in the database');
            }

            const processedData = await this.prisma.processedData.findUnique({
                where:{
                    documentId: documentId
                }
            });

            if(!processedData) {
                console.log(`[UiPath ERROR] Processed data not found for documentId: ${documentId}`);
                throw new NotFoundException('Document not processed yet!');   
            }

            const lineItems:lineItem[] = (processedData.extractedFields as any).result.line_items;
            const buyerData = processedData.extractedFields as { result: { buyer_ein: string } };

            let extractedData;
            let dataToSend:uiPathData;
            let releaseKey;
            
            if(currentClientCompanyEin === buyerData.result.buyer_ein) {
                extractedData = processedData.extractedFields as { result: { 
                    document_date: string,
                    due_date: string,
                    document_number: number,
                    vendor_ein: number
                }};

                dataToSend = {
                    createdDate: extractedData.result.document_date || '',
                    dueDate: extractedData.result.due_date || '',
                    documentNumber: extractedData.result.document_number,
                    sellerEin: extractedData.result.vendor_ein,
                    lineItems: lineItems
                };

                releaseKey = this.configService.get('UIPATH_RELEASE_KEY_FACTURI_INTRARI');
            } else {
                extractedData = processedData.extractedFields as { result: { 
                    document_date: string,
                    due_date: string,
                    document_number: number,
                    buyer_ein: number
                }};

                dataToSend = {
                    createdDate: extractedData.result.document_date || '',
                    dueDate: extractedData.result.due_date || '',
                    documentNumber: extractedData.result.document_number,
                    buyerEin: extractedData.result.buyer_ein,
                    lineItems: lineItems
                };

                releaseKey = this.configService.get('UIPATH_RELEASE_KEY');
            }

            const accessToken = await this.getAccessToken();
            
            const inputArguments = JSON.stringify({ in_JsonInput:dataToSend });
            const payload = {
                startInfo: {
                    ReleaseKey: releaseKey,
                    Strategy: 'ModernJobsCount',
                    JobsCount: 1,
                    InputArguments: inputArguments,
                },
            }

            const orchestratorUrl = `https://cloud.uipath.com/${this.configService.get('UIPATH_ACCOUNT_LOGICAL_NAME')}/${this.configService.get('UIPATH_TENANT_NAME')}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
            
            const uiPathResponse = await this.httpService.post(
                orchestratorUrl,
                payload,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-UIPATH-FolderPath': "Shared",
                  },
                }
              ).toPromise();

            console.log(`[UiPath] UiPath Response Status: ${uiPathResponse.status}`);

            const jobKey = uiPathResponse.data?.value?.[0]?.Key;
            console.log(`[UiPath] Job Key extracted: ${jobKey}`);

            let initialStatus:RpaActionStatus = RpaActionStatus.FAILED;
            
            if (jobKey) {
                initialStatus = RpaActionStatus.PENDING;
                console.log(`[UiPath] Job started successfully with key: ${jobKey}`);
            } else {
                console.log(`[UiPath ERROR] No job key received, marking as FAILED`);
            }
            
            const rpaAction = await this.prisma.rpaAction.create({
                data:{
                    documentId: document.id,
                    accountingClientId: document.accountingClientId,
                    actionType: RpaActionType.DATA_ENTRY,
                    status: initialStatus,
                    result: { 
                        ...uiPathResponse.data,
                        jobKey: jobKey,
                        httpStatus: uiPathResponse.status,
                        timestamp: new Date().toISOString(),
                        requestPayload: payload
                    },
                    triggeredById: userId,
                }
            });

            console.log(`[UiPath] RPA Action created with ID: ${rpaAction.id}, Status: ${initialStatus}`);

            return {
                uiPathResponse: uiPathResponse.data,
                rpaAction
            };

        } catch (e) {
            console.error(`[UiPath ERROR] Failed to trigger UiPath automation:`, e);
            
            const document = await this.prisma.document.findUnique({
                where:{
                    id: documentId
                },
                select:{
                    accountingClientId: true,
                }
            });

            if(document) {
                await this.prisma.rpaAction.create({
                    data: {
                      documentId: documentId,
                      accountingClientId: document.accountingClientId,
                      actionType: RpaActionType.DATA_ENTRY,
                      status: RpaActionStatus.FAILED,
                      result: { 
                        error: e.message, 
                        details: e.response?.data || null,
                        httpStatus: e.response?.status || null,
                        timestamp: new Date().toISOString()
                      },
                      triggeredById: userId
                    }
                });
            }
              
            throw new InternalServerErrorException('Failed to process invoice with UiPath');
        }
    }

    async checkJobStatus(jobKey: string): Promise<string> {
        console.log(`[UiPath] Checking job status for key: ${jobKey}`);
        
        try {
            const accessToken = await this.getAccessToken();

            const orchestratorUrl = `https://cloud.uipath.com/${this.configService.get('UIPATH_ACCOUNT_LOGICAL_NAME')}/${this.configService.get('UIPATH_TENANT_NAME')}/orchestrator_/odata/Jobs(${jobKey})`;

            const response = await this.httpService.get(
                orchestratorUrl,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'X-UIPATH-FolderPath': "Shared",
                    },
                }
            ).toPromise();

            console.log(`[UiPath] Job current state: ${response.data.State}`);
            return response.data.State;

        } catch (e) {
            console.error(`[UiPath ERROR] Failed to check UiPath job status for key ${jobKey}:`, e);

            if (e.response?.status === 404) {
                console.log(`[UiPath] Job ${jobKey} not found (404), returning NotFound status`);
                return 'NotFound';
            }

            throw new InternalServerErrorException('Failed to check UiPath job status');
        }
    }

    async getJobStatus(documentId: number): Promise<any> {
        console.log(`[UiPath] Getting job status for documentId: ${documentId}`);
        
        try {
            const rpaAction = await this.prisma.rpaAction.findFirst({
                where: {
                    documentId: documentId,
                    actionType: RpaActionType.DATA_ENTRY
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            if (!rpaAction) {
                console.log(`[UiPath] No RPA action found for documentId: ${documentId}`);
                return {
                    documentId,
                    status: 'PENDING',
                    details: { message: 'No automation started yet' }
                };
            }

            console.log(`[UiPath] Found RPA action with status: ${rpaAction.status}`);

            if (rpaAction.status !== RpaActionStatus.PENDING) {
                console.log(`[UiPath] Job is not pending, returning current status: ${rpaAction.status}`);
                return {
                    documentId,
                    status: rpaAction.status,
                    details: rpaAction.result
                };
            }

            const jobKey = (rpaAction.result as { jobKey: string })?.jobKey;
            if (!jobKey) {
                console.log(`[UiPath ERROR] No job key found in RPA action for documentId: ${documentId}`);
                return {
                    documentId,
                    status: 'FAILED',
                    details: { error: 'Job key not found in RPA action' }
                };
            }

            console.log(`[UiPath] Checking UiPath status for job key: ${jobKey}`);
            
            const createdAt = new Date(rpaAction.createdAt);
            const now = new Date();
            const minutesElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60);
            
            console.log(`[UiPath] Job created ${minutesElapsed.toFixed(2)} minutes ago`);
            
            if (minutesElapsed < 0.5) {
                console.log(`[UiPath] Job too recent, keeping PENDING status`);
                return {
                    documentId,
                    status: 'PENDING',
                    details: { 
                        message: 'Job recently created, waiting before status check',
                        minutesElapsed: minutesElapsed.toFixed(2)
                    }
                };
            }

            let jobStatus: string;
            let statusCheckAttempts = 0;
            const maxStatusCheckAttempts = 3;
            
            while (statusCheckAttempts < maxStatusCheckAttempts) {
                try {
                    statusCheckAttempts++;
                    console.log(`[UiPath] Status check attempt ${statusCheckAttempts} for job ${jobKey}`);
                    
                    jobStatus = await this.checkJobStatus(jobKey);
                    
                    if (jobStatus !== 'NotFound') {
                        break;
                    }
                    
                    if (statusCheckAttempts < maxStatusCheckAttempts) {
                        console.log(`[UiPath] Job not found, waiting 2 seconds before retry...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                } catch (statusError) {
                    console.error(`[UiPath ERROR] Status check attempt ${statusCheckAttempts} failed:`, statusError.message);
                    if (statusCheckAttempts >= maxStatusCheckAttempts) {
                        jobStatus = 'CheckFailed';
                    }
                }
            }
            
            console.log(`[UiPath] Final job status after ${statusCheckAttempts} attempts: ${jobStatus}`);
            
            let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;

            if (jobStatus === 'Successful') {
                updatedStatus = RpaActionStatus.COMPLETED;
            } else if (jobStatus === 'Faulted' || jobStatus === 'Stopped') {
                updatedStatus = RpaActionStatus.FAILED;
            } else if (jobStatus === 'Running' || jobStatus === 'Pending') {
                updatedStatus = RpaActionStatus.PENDING;
            } else if (jobStatus === 'NotFound' || jobStatus === 'CheckFailed') {
                if (minutesElapsed > 15) {
                    updatedStatus = RpaActionStatus.COMPLETED;
                    console.log(`[UiPath] Job older than 15 minutes and not found, assuming completed`);
                } else if (minutesElapsed > 5) {
                    updatedStatus = RpaActionStatus.COMPLETED;
                    console.log(`[UiPath] Job between 5-15 minutes old and not found, assuming completed`);
                } else {
                    updatedStatus = RpaActionStatus.PENDING;
                    console.log(`[UiPath] Job less than 5 minutes old and not found, keeping pending`);
                }
            }

            console.log(`[UiPath] Mapped status: ${updatedStatus} (from UiPath status: ${jobStatus})`);

            if (updatedStatus !== RpaActionStatus.PENDING) {
                console.log(`[UiPath] Updating database status to: ${updatedStatus}`);
                await this.prisma.rpaAction.update({
                    where: { id: rpaAction.id },
                    data: {
                        status: updatedStatus,
                        result: {
                            ...(rpaAction.result as object || {}),
                            finalStatus: jobStatus,
                            lastUpdated: new Date().toISOString(),
                            statusCheckAttempts: statusCheckAttempts,
                            minutesElapsed: minutesElapsed.toFixed(2)
                        }
                    }
                });
            }

            const result = {
                documentId,
                status: updatedStatus,
                details: {
                    ...(rpaAction.result as object || {}),
                    uiPathStatus: jobStatus,
                    minutesElapsed: minutesElapsed.toFixed(2)
                }
            };

            console.log(`[UiPath] Returning status result:`, JSON.stringify(result, null, 2));
            return result;
            
        } catch (error) {
            console.error(`[UiPath ERROR] Failed to get job status for documentId ${documentId}:`, error);
            
            return {
                documentId,
                status: 'FAILED',
                details: { 
                    error: 'Failed to check job status',
                    message: error.message 
                }
            };
        }
    }

    @Cron('0 */2 * * * *') 
    async updatePendingJobStatuses() {
        console.log('[UiPath CRON] Running scheduled UiPath job status update');
        
        try {
            const oneMinuteAgo = new Date();
            oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
            
            const twoHoursAgo = new Date();
            twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

            const pendingActions = await this.prisma.rpaAction.findMany({
                where: {
                    status: RpaActionStatus.PENDING,
                    actionType: RpaActionType.DATA_ENTRY,
                    createdAt: {
                        gte: twoHoursAgo,
                        lte: oneMinuteAgo 
                    }
                }
            });

            console.log(`[UiPath CRON] Found ${pendingActions.length} pending actions to check`);

            for (const action of pendingActions) {
                try {
                    console.log(`[UiPath CRON] Checking action ID: ${action.id} for documentId: ${action.documentId}`);
                    
                    const jobKey = (action.result as { jobKey: string })?.jobKey;
                    if (!jobKey) {
                        console.log(`[UiPath CRON] No job key for action ID: ${action.id}, marking as failed`);
                        await this.prisma.rpaAction.update({
                            where: { id: action.id },
                            data: {
                                status: RpaActionStatus.FAILED,
                                result: {
                                    ...(action.result as object || {}),
                                    cronError: 'No job key found',
                                    cronUpdated: new Date().toISOString()
                                }
                            }
                        });
                        continue;
                    }

                    const createdAt = new Date(action.createdAt);
                    const now = new Date();
                    const minutesElapsed = (now.getTime() - createdAt.getTime()) / (1000 * 60);

                    let jobStatus: string;
                    try {
                        jobStatus = await this.checkJobStatus(jobKey);
                    } catch (statusError) {
                        console.log(`[UiPath CRON] Failed to check status for action ${action.id}`);
                        
                        if (minutesElapsed > 30) {
                            jobStatus = 'AssumedCompleted';
                        } else {
                            continue;
                        }
                    }

                    let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;

                    if (jobStatus === 'Successful' || jobStatus === 'AssumedCompleted') {
                        updatedStatus = RpaActionStatus.COMPLETED;
                    } else if (jobStatus === 'Faulted' || jobStatus === 'Stopped') {
                        updatedStatus = RpaActionStatus.FAILED;
                    } else if (jobStatus === 'NotFound') {
                        if (minutesElapsed > 15) {
                            updatedStatus = RpaActionStatus.COMPLETED;
                        } else if (minutesElapsed > 10) {
                            updatedStatus = RpaActionStatus.COMPLETED;
                        }
                    }

                    if (updatedStatus !== RpaActionStatus.PENDING) {
                        await this.prisma.rpaAction.update({
                            where: { id: action.id },
                            data: {
                                status: updatedStatus,
                                result: {
                                    ...(action.result as object || {}),
                                    finalStatus: jobStatus,
                                    cronUpdated: new Date().toISOString(),
                                    cronMinutesElapsed: minutesElapsed.toFixed(2)
                                }
                            }
                        });
                        console.log(`[UiPath CRON] Updated job status for action ${action.id} to ${updatedStatus}`);
                    }
                } catch (error) {
                    console.error(`[UiPath CRON ERROR] Failed to update status for action ${action.id}:`, error);
                }
            }

            const oneDayAgo = new Date();
            oneDayAgo.setHours(oneDayAgo.getHours() - 24);

            const veryOldPendingActions = await this.prisma.rpaAction.findMany({
                where: {
                    status: RpaActionStatus.PENDING,
                    actionType: RpaActionType.DATA_ENTRY,
                    createdAt: {
                        lt: oneDayAgo
                    }
                }
            });

            if (veryOldPendingActions.length > 0) {
                console.log(`[UiPath CRON] Found ${veryOldPendingActions.length} very old pending actions, marking as completed (assumed successful)`);
                
                for (const oldAction of veryOldPendingActions) {
                    await this.prisma.rpaAction.update({
                        where: { id: oldAction.id },
                        data: {
                            status: RpaActionStatus.COMPLETED,
                            result: {
                                ...(oldAction.result as object || {}),
                                completionReason: 'Assumed completed after 24+ hours',
                                cronTimeout: new Date().toISOString()
                            }
                        }
                    });
                }
            }

        } catch (error) {
            console.error('[UiPath CRON ERROR] Failed to run scheduled job status update:', error);
        }
    }

    async getAccessToken(): Promise<string> {
        const clientId = this.configService.get('UIPATH_CLIENT_ID');
        const clientSecret = this.configService.get('UIPATH_CLIENT_SECRET');

        const data = qs.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'OR.Jobs.Write OR.Jobs.Read',
        });
    
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
    
        try {
            const response = await this.httpService.post(
                'https://cloud.uipath.com/identity_/connect/token',
                data,
                { headers }
            ).toPromise();

            return response.data.access_token;
        } catch (error) {
            console.error('[UiPath ERROR] Failed to get access token:', error);
            throw error;
        }
    }

    async getManagement(ein) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: ein
                },
                select:{
                    id: true
                }
            });

            if(!clientCompany) throw new NotFoundException('Failed to find the client company in the database!');

            const managementList = await this.prisma.management.findMany({
                where:{
                    clientCompanyId: clientCompany.id
                }
            });

            if(managementList.length ===0) throw new NotFoundException('Management list not found in the database!');

            return managementList;

        } catch (e) {
            console.error("Failed to fetch the management list:", e);
        }
    }

    async getArticles(ein) {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: ein
                }
            });

            if(!clientCompany) throw new NotFoundException('Failed to find the client company in the database!');

            const articlesList = await this.prisma.article.findMany({
                where:{
                    clientCompanyId: clientCompany.id
                },
                select:{
                        id:true,
                        code:true,
                        name:true,           
                        vat: true,           
                        unitOfMeasure: true,   
                        type: true         
                }
            });

            if(articlesList.length === 0) throw new NotFoundException('Articles list not found in the database!');

            return articlesList;

        } catch (e) {
            console.error('Failed to fetch the articles list:', e);
        }
    }
}