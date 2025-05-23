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

    async postClientInvoice(documentId:number, userId: number, currentClientCompanyEin: string)
    {
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

            console.log(`[UiPath] Document found: ${JSON.stringify(document)}`);

            const processedData = await this.prisma.processedData.findUnique({
                where:{
                    documentId: documentId
                }
            });

            if(!processedData) {
                console.log(`[UiPath ERROR] Processed data not found for documentId: ${documentId}`);
                throw new NotFoundException('Document not processed yet!');   
            }

            console.log(`[UiPath] Processed data found for documentId: ${documentId}`);
            
            const lineItems:lineItem[] = (processedData.extractedFields as any).result.line_items;
            const buyerData = processedData.extractedFields as { result: { buyer_ein: string } };

            console.log(`[UiPath] Line items count: ${lineItems?.length || 0}`);
            console.log(`[UiPath] Buyer EIN: ${buyerData.result.buyer_ein}`);
            console.log(`[UiPath] Current client EIN: ${currentClientCompanyEin}`);

            let extractedData;
            let dataToSend:uiPathData;
            let releaseKey;
            
            if(currentClientCompanyEin === buyerData.result.buyer_ein)
            {
                console.log(`[UiPath] Processing as INTRARI (Furnizori) - client is buyer`);
                //Intrari - Furnizori
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
                console.log(`[UiPath] Using INTRARI release key: ${releaseKey ? 'SET' : 'NOT SET'}`);
            }
            else
            {
                console.log(`[UiPath] Processing as IESIRI (Clienti) - client is seller`);
                //Iesiri - Clienti
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
                console.log(`[UiPath] Using IESIRI release key: ${releaseKey ? 'SET' : 'NOT SET'}`);
            }

            console.log(`[UiPath] Data to send to UiPath:`, JSON.stringify(dataToSend, null, 2));

            const accessToken = await this.getAccessToken();
            console.log(`[UiPath] Access token obtained: ${accessToken ? 'SUCCESS' : 'FAILED'}`);
            
            const inputArguments = JSON.stringify({ in_JsonInput:dataToSend });
            const payload = {
                startInfo: {
                    ReleaseKey: releaseKey,
                    Strategy: 'ModernJobsCount',
                    JobsCount: 1,
                    InputArguments: inputArguments,
                },
            }

            console.log(`[UiPath] Payload to UiPath:`, JSON.stringify(payload, null, 2));

            const orchestratorUrl = `https://cloud.uipath.com/${this.configService.get('UIPATH_ACCOUNT_LOGICAL_NAME')}/${this.configService.get('UIPATH_TENANT_NAME')}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`;
            
            console.log(`[UiPath] Making request to: ${orchestratorUrl}`);
            console.log(`[UiPath] Request headers:`, {
                'Authorization': `Bearer ${accessToken?.substring(0, 20)}...`,
                'Content-Type': 'application/json',
                'X-UIPATH-FolderPath': "Shared",
            });

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
            console.log(`[UiPath] UiPath Response Headers:`, JSON.stringify(uiPathResponse.headers, null, 2));
            console.log(`[UiPath] UiPath Response Data:`, JSON.stringify(uiPathResponse.data, null, 2));

            const jobKey = uiPathResponse.data?.value?.[0]?.Key;
            console.log(`[UiPath] Job Key extracted: ${jobKey}`);

            let initialStatus:RpaActionStatus = RpaActionStatus.FAILED;
            
            if (jobKey) {
                initialStatus = RpaActionStatus.PENDING;
                console.log(`[UiPath] Job started successfully with key: ${jobKey}`);
            } else {
                console.log(`[UiPath ERROR] No job key received, marking as FAILED`);
                console.log(`[UiPath ERROR] Response structure:`, JSON.stringify(uiPathResponse.data, null, 2));
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
            console.error(`[UiPath ERROR] Error details:`, {
                message: e.message,
                status: e.response?.status,
                statusText: e.response?.statusText,
                data: e.response?.data,
                headers: e.response?.headers
            });
            
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

    async checkJobStatus(jobKey: string): Promise<string>{
        console.log(`[UiPath] Checking job status for key: ${jobKey}`);
        
        try {
            const accessToken = await this.getAccessToken();

            const orchestratorUrl = `https://cloud.uipath.com/${this.configService.get('UIPATH_ACCOUNT_LOGICAL_NAME')}/${this.configService.get('UIPATH_TENANT_NAME')}/orchestrator_/odata/Jobs(${jobKey})`;

            console.log(`[UiPath] Status check URL: ${orchestratorUrl}`);

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

            console.log(`[UiPath] Job status response:`, JSON.stringify(response.data, null, 2));
            console.log(`[UiPath] Job current state: ${response.data.State}`);

            return response.data.State;

        } catch (e) {
            console.error(`[UiPath ERROR] Failed to check UiPath job status for key ${jobKey}:`, e);
            console.error(`[UiPath ERROR] Status check error details:`, {
                message: e.message,
                status: e.response?.status,
                data: e.response?.data
            });
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
                console.log(`[UiPath ERROR] No RPA action found for documentId: ${documentId}`);
                throw new NotFoundException('No UiPath job found for this document');
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
                throw new NotFoundException('Job key not found in RPA action');
            }

            console.log(`[UiPath] Checking UiPath status for job key: ${jobKey}`);
            const jobStatus = await this.checkJobStatus(jobKey);
            
            let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;

            console.log(`[UiPath] UiPath job status: ${jobStatus}`);

            if (jobStatus === 'Successful') {
                updatedStatus = RpaActionStatus.COMPLETED;
            } else if (jobStatus === 'Faulted' || jobStatus === 'Stopped') {
                updatedStatus = RpaActionStatus.FAILED;
            } else if (jobStatus === 'Running' || jobStatus === 'Pending') {
                updatedStatus = RpaActionStatus.PENDING;
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
                            lastUpdated: new Date().toISOString()
                        }
                    }
                });
            }

            const result = {
                documentId,
                status: updatedStatus,
                details: {
                    ...(rpaAction.result as object || {}),
                    uiPathStatus: jobStatus
                }
            };

            console.log(`[UiPath] Returning status result:`, JSON.stringify(result, null, 2));
            return result;
            
        } catch (error) {
            console.error(`[UiPath ERROR] Failed to get job status for documentId ${documentId}:`, error);
            throw new InternalServerErrorException('Failed to get UiPath job status');
        }
    }

    @Cron('0 */5 * * * *')
    async updatePendingJobStatuses() {
        console.log('[UiPath CRON] Running scheduled UiPath job status update');
        
        try {
            const pendingActions = await this.prisma.rpaAction.findMany({
                where: {
                    status: RpaActionStatus.PENDING,
                    actionType: RpaActionType.DATA_ENTRY
                }
            });

            console.log(`[UiPath CRON] Found ${pendingActions.length} pending actions to check`);

            for (const action of pendingActions) {
                try {
                    console.log(`[UiPath CRON] Checking action ID: ${action.id} for documentId: ${action.documentId}`);
                    
                    const jobKey = (action.result as { jobKey: string })?.jobKey;
                    if (!jobKey) {
                        console.log(`[UiPath CRON] No job key for action ID: ${action.id}, skipping`);
                        continue;
                    }

                    const jobStatus = await this.checkJobStatus(jobKey);
                    let updatedStatus: RpaActionStatus = RpaActionStatus.PENDING;

                    if (jobStatus === 'Successful') {
                        updatedStatus = RpaActionStatus.COMPLETED;
                    } else if (jobStatus === 'Faulted' || jobStatus === 'Stopped') {
                        updatedStatus = RpaActionStatus.FAILED;
                    }

                    if (updatedStatus !== RpaActionStatus.PENDING) {
                        await this.prisma.rpaAction.update({
                            where: { id: action.id },
                            data: {
                                status: updatedStatus,
                                result: {
                                    ...(action.result as object || {}),
                                    finalStatus: jobStatus,
                                    cronUpdated: new Date().toISOString()
                                }
                            }
                        });
                        console.log(`[UiPath CRON] Updated job status for action ${action.id} to ${updatedStatus}`);
                    } else {
                        console.log(`[UiPath CRON] Action ${action.id} still pending with status: ${jobStatus}`);
                    }
                } catch (error) {
                    console.error(`[UiPath CRON ERROR] Failed to update status for action ${action.id}:`, error);
                }
            }
        } catch (error) {
            console.error('[UiPath CRON ERROR] Failed to run scheduled job status update:', error);
        }
    }

    async getAccessToken(): Promise<string> {
        console.log('[UiPath] Getting access token');
        
        const clientId = this.configService.get('UIPATH_CLIENT_ID');
        const clientSecret = this.configService.get('UIPATH_CLIENT_SECRET');
    
        console.log(`[UiPath] Client ID: ${clientId ? 'SET' : 'NOT SET'}`);
        console.log(`[UiPath] Client Secret: ${clientSecret ? 'SET' : 'NOT SET'}`);

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

            console.log('[UiPath] Access token obtained successfully');
            return response.data.access_token;
        } catch (error) {
            console.error('[UiPath ERROR] Failed to get access token:', error);
            console.error('[UiPath ERROR] Token error details:', {
                status: error.response?.status,
                data: error.response?.data
            });
            throw error;
        }
    }

    async getManagement(ein){
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

    async getArticles(ein){
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