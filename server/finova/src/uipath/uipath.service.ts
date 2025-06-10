import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, RpaActionStatus, RpaActionType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import * as qs from 'qs';
import {Cron} from '@nestjs/schedule';
import { ModifyRpaDto } from './dto';

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
    buyer?: string,
    seller?: string,
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

            const user = await this.prisma.user.findUnique({
                where: {
                    id: userId
                }
            });

            const accountingCompanyId = user.accountingCompanyId;

            const accountingCompany = await this.prisma.accountingCompany.findUnique({
                where:{
                    id: accountingCompanyId
                }
            });

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
                    vendor_ein: number,
                    vendor: string
                }};

                dataToSend = {
                    createdDate: extractedData.result.document_date || '',
                    dueDate: extractedData.result.due_date || '',
                    documentNumber: extractedData.result.document_number,
                    sellerEin: extractedData.result.vendor_ein,
                    seller: extractedData.result.vendor,
                    lineItems: lineItems
                };

                releaseKey = accountingCompany.supplierInvoiceRk;
            } else {
                extractedData = processedData.extractedFields as { result: { 
                    document_date: string,
                    due_date: string,
                    document_number: number,
                    buyer_ein: number,
                    buyer: string
                }};

                dataToSend = {
                    createdDate: extractedData.result.document_date || '',
                    dueDate: extractedData.result.due_date || '',
                    documentNumber: extractedData.result.document_number,
                    buyerEin: extractedData.result.buyer_ein,
                    buyer: extractedData.result.buyer,
                    lineItems: lineItems
                };

                releaseKey = accountingCompany.clientInvoiceRk;
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

            const currentUipathSubfolder = accountingCompany.uipathSubfolder;

            if (!currentUipathSubfolder || currentUipathSubfolder.length===0) throw new NotFoundException('Missing uipath subfolder');
            
            const uiPathResponse = await this.httpService.post(
                orchestratorUrl,
                payload,
                {
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'X-UIPATH-FolderPath': `Shared/${currentUipathSubfolder}`,
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

    async checkJobStatus(jobKey: string): Promise<{ status: string, details: any }> {
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

            const jobData = response.data;
            console.log(`[UiPath] Job State: ${jobData.State}, StartTime: ${jobData.StartTime}, EndTime: ${jobData.EndTime}`);
            
            return {
                status: jobData.State,
                details: {
                    startTime: jobData.StartTime,
                    endTime: jobData.EndTime,
                    state: jobData.State,
                    jobError: jobData.JobError,
                    info: jobData.Info,
                    outputArguments: jobData.OutputArguments
                }
            };

        } catch (e) {
            console.error(`[UiPath ERROR] Failed to check UiPath job status for key ${jobKey}:`, e);

            if (e.response?.status === 404) {
                console.log(`[UiPath] Job ${jobKey} not found (404)`);
                return {
                    status: 'NotFound',
                    details: { error: 'Job not found in UiPath' }
                };
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

            let jobStatusResult: { status: string, details: any };
            
            try {
                jobStatusResult = await this.checkJobStatus(jobKey);
                console.log(`[UiPath] UiPath job status result:`, jobStatusResult);
            } catch (statusError) {
                console.error(`[UiPath ERROR] Status check failed:`, statusError.message);
                
                if (minutesElapsed > 20) {
                    jobStatusResult = {
                        status: 'AssumedCompleted',
                        details: { reason: 'Status check failed but job is old, assuming completed' }
                    };
                } else {
                    return {
                        documentId,
                        status: 'PENDING',
                        details: { 
                            error: 'Status check failed, will retry later',
                            minutesElapsed: minutesElapsed.toFixed(2)
                        }
                    };
                }
            }

            let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;
            let shouldUpdate = false;

            if (jobStatusResult.status === 'Successful') {
                updatedStatus = RpaActionStatus.COMPLETED;
                shouldUpdate = true;
            } else if (jobStatusResult.status === 'Faulted' || jobStatusResult.status === 'Stopped') {
                updatedStatus = RpaActionStatus.FAILED;
                shouldUpdate = true;
            } else if (jobStatusResult.status === 'Running') {
                updatedStatus = RpaActionStatus.PENDING;
            } else if (jobStatusResult.status === 'Pending') {
                if (minutesElapsed > 15 && !jobStatusResult.details.startTime) {
                    console.log(`[UiPath] Job stuck in Pending state for ${minutesElapsed.toFixed(2)} minutes without starting`);
                    updatedStatus = RpaActionStatus.FAILED;
                    shouldUpdate = true;
                } else {
                    updatedStatus = RpaActionStatus.PENDING;
                }
            } else if (jobStatusResult.status === 'NotFound') {
                if (minutesElapsed > 10) {
                    console.log(`[UiPath] Job not found and older than 10 minutes, assuming completed`);
                    updatedStatus = RpaActionStatus.COMPLETED;
                    shouldUpdate = true;
                } else {
                    console.log(`[UiPath] Job not found but too recent, keeping pending`);
                    updatedStatus = RpaActionStatus.PENDING;
                }
            } else if (jobStatusResult.status === 'AssumedCompleted') {
                updatedStatus = RpaActionStatus.COMPLETED;
                shouldUpdate = true;
            }

            console.log(`[UiPath] Mapped status: ${updatedStatus} (from UiPath status: ${jobStatusResult.status}), shouldUpdate: ${shouldUpdate}`);

            if (shouldUpdate) {
                console.log(`[UiPath] Updating database status to: ${updatedStatus}`);
                await this.prisma.rpaAction.update({
                    where: { id: rpaAction.id },
                    data: {
                        status: updatedStatus,
                        result: {
                            ...(rpaAction.result as object || {}),
                            finalStatus: jobStatusResult.status,
                            finalDetails: jobStatusResult.details,
                            lastUpdated: new Date().toISOString(),
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
                    uiPathStatus: jobStatusResult.status,
                    uiPathDetails: jobStatusResult.details,
                    minutesElapsed: minutesElapsed.toFixed(2)
                }
            };

            console.log(`[UiPath] Returning status result: documentId=${documentId}, status=${updatedStatus}`);
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

    @Cron('0 */3 * * * *')
    async updatePendingJobStatuses() {
        console.log('[UiPath CRON] Running scheduled UiPath job status update');
        
        try {
            const oneMinuteAgo = new Date();
            oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
            
            const fourHoursAgo = new Date();
            fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

            const pendingActions = await this.prisma.rpaAction.findMany({
                where: {
                    status: RpaActionStatus.PENDING,
                    actionType: RpaActionType.DATA_ENTRY,
                    createdAt: {
                        gte: fourHoursAgo,
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

                    let jobStatusResult: { status: string, details: any };
                    
                    try {
                        jobStatusResult = await this.checkJobStatus(jobKey);
                    } catch (statusError) {
                        console.log(`[UiPath CRON] Failed to check status for action ${action.id}, minutes elapsed: ${minutesElapsed.toFixed(2)}`);
                        
                        if (minutesElapsed > 60) {
                            jobStatusResult = {
                                status: 'AssumedCompleted',
                                details: { reason: 'Status check failed, assuming completed due to age' }
                            };
                        } else {
                            continue; 
                        }
                    }

                    let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;

                    if (jobStatusResult.status === 'Successful' || jobStatusResult.status === 'AssumedCompleted') {
                        updatedStatus = RpaActionStatus.COMPLETED;
                    } else if (jobStatusResult.status === 'Faulted' || jobStatusResult.status === 'Stopped') {
                        updatedStatus = RpaActionStatus.FAILED;
                    } else if (jobStatusResult.status === 'Pending') {
                        if (minutesElapsed > 30 && !jobStatusResult.details.startTime) {
                            updatedStatus = RpaActionStatus.FAILED;
                        }
                    } else if (jobStatusResult.status === 'NotFound') {
                        if (minutesElapsed > 15) {
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
                                    finalStatus: jobStatusResult.status,
                                    finalDetails: jobStatusResult.details,
                                    cronUpdated: new Date().toISOString(),
                                    cronMinutesElapsed: minutesElapsed.toFixed(2)
                                }
                            }
                        });
                        console.log(`[UiPath CRON] Updated job status for action ${action.id} to ${updatedStatus}`);
                    } else {
                        console.log(`[UiPath CRON] Action ${action.id} still pending, will check again later`);
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
                console.log(`[UiPath CRON] Found ${veryOldPendingActions.length} very old pending actions, marking as completed`);
                
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

    async getManagement(ein: string, user: User) {
        try {
            const currentUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                select: { accountingCompanyId: true }
            });
    
            if (!currentUser) {
                throw new NotFoundException('User not found in the database!');
            }
    
            const managementList = await this.prisma.management.findMany({
                where: {
                    accountingClient: {
                        accountingCompanyId: currentUser.accountingCompanyId,
                        clientCompany: {
                            ein: ein
                        }
                    }
                },
                include: {
                    clientCompany: {
                        select: { name: true, ein: true }
                    }
                }
            });
    
            if (managementList.length === 0) {
                throw new NotFoundException('Management list not found or you don\'t have access to this client!');
            }
    
            return managementList;
    
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            console.error("Failed to fetch the management list:", e);
            throw new InternalServerErrorException('Failed to fetch management data');
        }
    }
    

    async getArticles(ein: string, user: User) {
        try {
            const currentUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                select: { accountingCompanyId: true }
            });
    
            if (!currentUser) {
                throw new NotFoundException('User not found in the database!');
            }
    
            const articlesList = await this.prisma.article.findMany({
                where: {
                    accountingClient: {
                        accountingCompanyId: currentUser.accountingCompanyId,
                        clientCompany: {
                            ein: ein
                        }
                    }
                },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    vat: true,
                    unitOfMeasure: true,
                    type: true,
                    clientCompany: {
                        select: {
                            name: true,
                            ein: true
                        }
                    }
                }
            });
    
            if (articlesList.length === 0) {
                throw new NotFoundException('Articles list not found or you don\'t have access to this client!');
            }
    
            return articlesList;
    
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            console.error('Failed to fetch the articles list:', e);
            throw new InternalServerErrorException('Failed to fetch articles data');
        }
    }

    async getRpaData(User: User)
    {
        try {
            const user = await this.prisma.user.findUnique({
                where: {
                    id: User.id
                }
            });
            
            if(!user) throw new UnauthorizedException('You are not authorized to get RPA data');

            const accountingCompany = await this.prisma.accountingCompany.findUnique({
                where: {
                    id: user.accountingCompanyId
                }
            });

            if(!accountingCompany) throw new NotFoundException('user is not attributed to any accounting company');

            return {
                uipathSubfolder: accountingCompany.uipathSubfolder,
                clientInvoiceRk: accountingCompany.clientInvoiceRk,
                supplierInvoiceRk: accountingCompany.supplierInvoiceRk,
                clientReceiptRk: accountingCompany.clientReceiptRk,
                supplierReceiptRk: accountingCompany.supplierReceiptRk
            }

        } catch (e) {
            console.error('Failed to fetch the rpa data:', e);
            throw new InternalServerErrorException('Failed to fetch rpa data');
        }
    }
    
    async modifyRpaData(user:User, dto: ModifyRpaDto)
    {
        try {
            const userDetails = await this.prisma.user.findUnique({
                where: {
                    id: user.id
                }
            });
                if (!userDetails || !userDetails.accountingCompanyId) {
                throw new BadRequestException('User does not have an accounting company associated');
            }
                const accountingCompany = await this.prisma.accountingCompany.update({
                where: {
                    id: userDetails.accountingCompanyId
                },
                data: {
                    uipathSubfolder: dto.uipathSubfolder,
                    clientInvoiceRk: dto.clientInvoiceRk,
                    supplierInvoiceRk: dto.supplierInvoiceRk,
                    clientReceiptRk: dto.clientReceiptRk,
                    supplierReceiptRk: dto.supplierReceiptRk
                }
            });

            const rpaDetails = {
                uipathSubfolder: accountingCompany.uipathSubfolder,
                clientInvoiceRk: accountingCompany.clientInvoiceRk,
                supplierInvoiceRk: accountingCompany.supplierInvoiceRk,
                clientReceiptRk: accountingCompany.clientReceiptRk,
                supplierReceiptRk: accountingCompany.supplierReceiptRk
            };

            return rpaDetails;
        } catch (e) {
            console.error('Failed to modify the rpa data:', e);
            throw new InternalServerErrorException('Failed to modify the rpa data');
        }
    }
}