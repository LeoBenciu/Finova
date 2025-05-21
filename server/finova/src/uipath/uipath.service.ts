import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { RpaActionStatus, RpaActionType } from '@prisma/client';
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
        try {
            const document = await this.prisma.document.findUnique({
                where:{
                    id: documentId 
                }
            });

            if(!document) throw new NotFoundException('Document to process not found in the database');

            const processedData = await this.prisma.processedData.findUnique({
                where:{
                    documentId: documentId
                }
            });

            if(!processedData) throw new NotFoundException('Document not processed yet!');   
            
            const lineItems:lineItem[] = (processedData.extractedFields as any).result.line_items;

            const buyerData = processedData.extractedFields as { result: { buyer_ein: string } };

            let extractedData;
            let dataToSend:uiPathData;
            let releaseKey;
            if(currentClientCompanyEin === buyerData.result.buyer_ein)
            {
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

                releaseKey = this.configService.get('UIPATH_RELEASE_KEY_FACTURI_INTRARI')
            }
            else
            {
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

                releaseKey = this.configService.get('UIPATH_RELEASE_KEY')
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

            const jobKey = uiPathResponse.data?.value?.[0]?.Key;
            
            const rpaAction = await this.prisma.rpaAction.create({
                data:{
                    documentId: document.id,
                    accountingClientId: document.accountingClientId,
                    actionType: RpaActionType.DATA_ENTRY,
                    status: uiPathResponse.status === 200? RpaActionStatus.COMPLETED : RpaActionStatus.FAILED,
                    result: { 
                        ...uiPathResponse.data,
                        jobKey: jobKey
                    },
                    triggeredById: userId,

                }
            });

            return {
                uiPathResponse: uiPathResponse.data,
                rpaAction
            };


        } catch (e) {
            console.error('Failed to trigger UiPath automation:', e);
            if (e.response) {

                const document = await this.prisma.document.findUnique({
                    where:{
                        id: documentId
                    },
                    select:{
                        accountingClientId: true,
                    }
                });

                if(document)
                    {await this.prisma.rpaAction.create({
                    data: {
                      documentId: documentId,
                      accountingClientId: document.accountingClientId,
                      actionType: RpaActionType.DATA_ENTRY,
                      status: RpaActionStatus.FAILED,
                      result: { error: e.message, details: e.response?.data || null },
                      triggeredById: userId
                    }
                })}
              }
              
              throw new InternalServerErrorException('Failed to process invoice with UiPath');
        }
    }

    async checkJobStatus(jobKey: string): Promise<string>{
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

            return response.data.State;

        } catch (e) {
            console.error('Failed to check UiPath job status:', e);
            throw new InternalServerErrorException('Failed to check UiPath job status');
        }
    }

    async getJobStatus(documentId: number): Promise<any> {
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
                throw new NotFoundException('No UiPath job found for this document');
            }

            if (rpaAction.status !== RpaActionStatus.PENDING) {
                return {
                    documentId,
                    status: rpaAction.status,
                    details: rpaAction.result
                };
            }

            const jobKey = (rpaAction.result as { jobKey: string })?.jobKey;
            if (!jobKey) {
                throw new NotFoundException('Job key not found in RPA action');
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
                    where: { id: rpaAction.id },
                    data: {
                        status: updatedStatus,
                        result: {
                            ...(rpaAction.result as object || {}),
                            finalStatus: jobStatus
                        }
                    }
                });
            }

            return {
                documentId,
                status: updatedStatus,
                    details: {
                    ...(rpaAction.result as object || {}),
                    uiPathStatus: jobStatus
                }
            };
        } catch (error) {
            console.error('Failed to get job status:', error);
            throw new InternalServerErrorException('Failed to get UiPath job status');
        }
    }

    @Cron('0 */5 * * * *') // Run every 5 minutes
    async updatePendingJobStatuses() {
        try {
            console.log('Running scheduled UiPath job status update');
            
            const pendingActions = await this.prisma.rpaAction.findMany({
                where: {
                    status: RpaActionStatus.PENDING,
                    actionType: RpaActionType.DATA_ENTRY
                }
            });

            for (const action of pendingActions) {
                try {
                    const jobKey = (action.result as { jobKey: string })?.jobKey;
                    if (!jobKey) continue;

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
                                    finalStatus: jobStatus
                                }
                            }
                        });
                        console.log(`Updated job status for action ${action.id} to ${updatedStatus}`);
                    }
                } catch (error) {
                    console.error(`Failed to update status for action ${action.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Failed to run scheduled job status update:', error);
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
    
        const response = await this.httpService.post(
            'https://cloud.uipath.com/identity_/connect/token',
            data,
            { headers }
        ).toPromise();
    
        return response.data.access_token;
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
