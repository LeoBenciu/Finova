import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class FilesService {

    constructor(private prisma: PrismaService){}
    
    async getFiles(ein: string, user:User)
    {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: ein
                }
            });

            if(!clientCompany) throw new NotFoundException('Client Company not found in the database!');
            
            const accountingClientRelation = await this.prisma.accountingClients.findMany({
                where:{
                    accountingCompanyId:user.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });

            if(accountingClientRelation.length===0){ 
                throw new NotFoundException('No link found between client and accounting companies!')
            };

            const documents = await this.prisma.document.findMany({
                where:{
                    accountingClientId:accountingClientRelation[0].id
                }
            });

            if(documents.length===0) throw new NotFoundException('Documents not found in the database for this accountingClient relationship');

            const documentIds = documents.map(doc=>doc.id);
            const processedData = await this.prisma.processedData.findMany({
                where:{
                    documentId:{in:documentIds}
                }
            });

            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });

            const rpaAction = await this.prisma.rpaAction.findMany({
                where:{
                    documentId: {in:documentIds}
                }
            });

            const documentsWithProcessedData = await Promise.all(
                documents.map(async (document) => {
                    const signedUrl = await s3.getSignedUrlPromise('getObject', {
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: document.s3Key,
                        Expires: 60 * 60,
                    });
    
                    return {
                        ...document,
                        processedData: processedData.filter(pd => pd.documentId === document.id),
                        signedUrl,
                        rpa: rpaAction.filter(rp=>rp.documentId === document.id)
                    };
                })
            );


            return{
                documents:documentsWithProcessedData
            }
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to find documents in the database!");
        }
    }

    async postFile(clientEin:string,processedData:any,file:Express.Multer.File, user: User)
    {
        try{
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: clientEin
                }
            });
            if(!clientCompany) throw new NotFoundException('Client company doesn\'t exists in the database');

            const accountingClientRelation = await this.prisma.accountingClients.findMany({
                where:{
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId:  clientCompany.id
                }
            });
            if(!accountingClientRelation || accountingClientRelation.length===0) throw new NotFoundException('You don\'t have access to this client company');

            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });

            const fileKey = `${user.accountingCompanyId}/${clientCompany.id}/${Date.now()}-${file.originalname}`;

            const uploadResult = await s3.upload({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                Body: file.buffer,
                ContentType: file.mimetype
            }).promise();

            const document = await this.prisma.document.create({
                data:{
                    name: file.originalname ,
                    type:  processedData.result.document_type,
                    path: uploadResult.Location,
                    s3Key: fileKey,
                    contentType: file.mimetype,
                    fileSize: file.size,
                    accountingClientId: accountingClientRelation[0].id
                }
            });

            processedData.result.line_items.forEach(async(item)=>{
                if(item.isNew && item.type !== "Nedefinit"){
                    await this.prisma.article.create({
                        data:{
                            code: item.articleCode,
                            name: item.name,
                            vat: item.vat,
                            unitOfMeasure: item.um,
                            type: item.type,
                            clientCompanyId: clientCompany.id
                        }
                    })
                }
            });

            const processedDataDb = await this.prisma.processedData.create({
                data:{
                    documentId: document.id,
                    extractedFields: processedData
                }
            });


            
            return {savedDocument:document, savedProcessedData: processedDataDb}
        }
        catch(e){
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to save document and processed data in the database!");
        }

    }

    async updateFiles(processedData:any, clientCompanyEin:string, user:User, docId:number )
    {
        try {
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein:clientCompanyEin
                }
            });

            if(!clientCompany) throw new NotFoundException('Failed to find client company in the database');

            const accountingClientRelation = await this.prisma.accountingClients.findMany({
                where:{
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId:  clientCompany.id
                }
            });
            if( accountingClientRelation.length===0) throw new NotFoundException('You don\'t have access to this client company');

            const document = await this.prisma.document.findUnique({
                where: {
                  id: docId,
                  accountingClientId: accountingClientRelation[0].id
                }});

            if(!document) throw new NotFoundException('Document doesn\'t exist in the database');

            const updatedProcessedData = await this.prisma.processedData.update({
                where:{
                    documentId: docId
                },
                data:{
                    extractedFields:processedData
                }
            });

            return {document, updatedProcessedData}
        } catch (e) {
            if( e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to update the file's data!")
        }
    }

    async deleteFiles(clientCompanyEin: string, docId: number, user: User) {
        try {
          const clientCompany = await this.prisma.clientCompany.findUnique({
            where: { ein: clientCompanyEin }
          });
          
          if (!clientCompany) throw new NotFoundException('Failed to find client company in the database');
          
          const accountingClientRelation = await this.prisma.accountingClients.findMany({
            where: {
              accountingCompanyId: user.accountingCompanyId,
              clientCompanyId: clientCompany.id
            }
          });
          
          if (accountingClientRelation.length === 0) throw new NotFoundException('You don\'t have access to this client company');
          
          const document = await this.prisma.document.findUnique({
            where: {
              id: docId,
              accountingClientId: accountingClientRelation[0].id
            }
          });
          
          if (!document) throw new NotFoundException('Document not found');

          const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
          });

          await s3.deleteObject({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: document.s3Key
          }).promise();

          return await this.prisma.$transaction(async (prisma) => {
            const deletedProcessedData = await prisma.processedData.deleteMany({
              where: {
                documentId: docId
              }
            });
            
            const deletedRpaAction = await prisma.rpaAction.deleteMany({
              where: {
                documentId: docId,
                accountingClientId: accountingClientRelation[0].id
              }
            });
            
            const deletedDocument = await prisma.document.delete({
              where: {
                id: docId,
                accountingClientId: accountingClientRelation[0].id
              }
            });
            
            return {
              deletedDocument,
              deletedProcessedData,
              deletedRpaAction,
              s3DeleteStatus: 'Success'
            };
          });
          
        } catch (e) {
          if (e instanceof NotFoundException) throw e;
          if (e.code === 'NoSuchKey'){
            throw new InternalServerErrorException("File not found in S3 storage, but database records were deleted.");
          }
          throw new InternalServerErrorException("Failed to delete the file and its data!");
        }
      }
    }