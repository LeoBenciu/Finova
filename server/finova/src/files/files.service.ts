import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ArticleType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class FilesService {

    constructor(private prisma: PrismaService){}
    
    async getFiles(ein: string, user: User) {
        try {
            const currentUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    accountingCompany: true
                }
            });
    
            if (!currentUser) {
                throw new NotFoundException('User not found in the database!');
            }
    
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: ein }
            });
    
            if (!clientCompany) {
                throw new NotFoundException('Client Company not found in the database!');
            }
    
            const accountingClientRelation = await this.prisma.accountingClients.findFirst({
                where: {
                    accountingCompanyId: currentUser.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });
    
            if (!accountingClientRelation) {
                throw new NotFoundException('No authorized relationship found between your accounting company and this client!');
            }
    
            const documents = await this.prisma.document.findMany({
                where: {
                    accountingClientId: accountingClientRelation.id 
                },
                include: {
                    accountingClient: {
                        include: {
                            accountingCompany: {
                                select: { id: true, name: true, ein: true }
                            }
                        }
                    }
                }
            });
    
            console.log(`[DEBUG] User ${user.id} from company ${currentUser.accountingCompanyId} accessing ${documents.length} documents for client ${ein}`);
    
            const unauthorizedDocs = documents.filter(doc => 
                doc.accountingClient.accountingCompanyId !== currentUser.accountingCompanyId
            );
    
            if (unauthorizedDocs.length > 0) {
                console.error(`[SECURITY ALERT] Found ${unauthorizedDocs.length} unauthorized documents for user ${user.id}`);
                throw new UnauthorizedException('Unauthorized access to documents detected');
            }
    
            const s3 = new AWS.S3({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION
            });
    
            const documentIds = documents.map(doc => doc.id);
            
            const [processedData, rpaActions] = await Promise.all([
                this.prisma.processedData.findMany({
                    where: { documentId: { in: documentIds } }
                }),
                this.prisma.rpaAction.findMany({
                    where: { documentId: { in: documentIds } }
                })
            ]);
    
            const documentsWithData = await Promise.all(
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
                        rpa: rpaActions.filter(rp => rp.documentId === document.id)
                    };
                })
            );
    
            return {
                documents: documentsWithData,
                accountingCompany: {
                    id: currentUser.accountingCompanyId,
                    name: currentUser.accountingCompany.name,
                    ein: currentUser.accountingCompany.ein
                },
                clientCompany: {
                    id: clientCompany.id,
                    name: clientCompany.name,
                    ein: clientCompany.ein
                }
            };
    
        } catch (e) {
            if (e instanceof NotFoundException || e instanceof UnauthorizedException) throw e;
            console.error('[FILES_SERVICE_ERROR]', e);
            throw new InternalServerErrorException("Failed to find documents in the database!");
        }
    }

    async verifyDocumentAccess(documentId: number, user: User): Promise<boolean> {
        const document = await this.prisma.document.findUnique({
            where: { id: documentId },
            include: {
                accountingClient: {
                    include: {
                        accountingCompany: true
                    }
                }
            }
        });
    
        if (!document) {
            throw new NotFoundException('Document not found');
        }
    
        const hasAccess = document.accountingClient.accountingCompanyId === user.accountingCompanyId;
        
        if (!hasAccess) {
            console.error(`[SECURITY] User ${user.id} attempted to access document ${documentId} belonging to company ${document.accountingClient.accountingCompanyId}`);
        }
    
        return hasAccess;
    }

    async postFile(clientEin: string, processedData: any, file: Express.Multer.File, user: User) {
        let uploadResult;
        let fileKey;
        
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });
    
        try {
            const currentUser = await this.prisma.user.findUnique({
                where: { id: user.id },
                include: { accountingCompany: true }
            });
    
            if (!currentUser) {
                throw new NotFoundException('User not found in the database');
            }
    
            const clientCompany = await this.prisma.clientCompany.findUnique({
                where: { ein: clientEin }
            });
    
            if (!clientCompany) {
                throw new NotFoundException('Client company doesn\'t exist in the database');
            }
    
            const accountingClientRelation = await this.prisma.accountingClients.findFirst({
                where: {
                    accountingCompanyId: currentUser.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            });
    
            if (!accountingClientRelation) {
                throw new UnauthorizedException('You don\'t have access to this client company');
            }
    
            fileKey = `${currentUser.accountingCompanyId}/${clientCompany.id}/${Date.now()}-${file.originalname}`;
    
            uploadResult = await s3.upload({
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileKey,
                Body: file.buffer,
                ContentType: file.mimetype
            }).promise();
    
            const result = await this.prisma.$transaction(async (prisma) => {
                const document = await prisma.document.create({
                    data: {
                        name: file.originalname,
                        type: processedData.result.document_type,
                        path: uploadResult.Location,
                        s3Key: fileKey,
                        contentType: file.mimetype,
                        fileSize: file.size,
                        accountingClientId: accountingClientRelation.id
                    }
                });
    
                const processedDataDb = await prisma.processedData.create({
                    data: {
                        documentId: document.id,
                        extractedFields: processedData
                    }
                });
    
                if (processedData.result.line_items && processedData.result.line_items.length > 0) {
                    console.log(`[DEBUG] Creating articles from ${processedData.result.line_items.length} line items`);
    
                    const articlePromises = processedData.result.line_items
                        .filter(item => item.isNew && item.type !== "Nedefinit")
                        .map(async (item) => {
                            const typeMapping = {
                                'Marfuri': ArticleType.MARFURI,
                                'Produse finite': ArticleType.PRODUSE_FINITE,
                                'Ambalaje': ArticleType.AMBALAJE,
                                'Semifabricate': ArticleType.SEMIFABRICATE,
                                'Discount financiar iesiri': ArticleType.DISCOUNT_FINANCIAR_IESIRI,
                                'Discount financiar intrari': ArticleType.DISCOUNT_FINANCIAR_INTRARI,
                                'Discount comercial iesiri': ArticleType.DISCOUNT_COMERCIAL_IESIRI,
                                'Discount comercial intrari': ArticleType.DISCOUNT_COMERCIAL_INTRARI,
                                'Servicii vandute': ArticleType.SERVICII_VANDUTE,
                                'Ambalaje SGR': ArticleType.AMBALAJE_SGR,
                                'Taxa verde': ArticleType.TAXA_VERDE,
                                'Produse reziduale': ArticleType.PRODUSE_REZIDUALE,
                                'Materii prime': ArticleType.MATERII_PRIME,
                                'Materiale auxiliare': ArticleType.MATERIALE_AUXILIARE,
                                'Combustibili': ArticleType.COMBUSTIBILI,
                                'Piese de schimb': ArticleType.PIESE_DE_SCHIMB,
                                'Alte mat. consumabile': ArticleType.ALTE_MATERIALE_CONSUMABILE,
                                'Obiecte de inventar': ArticleType.OBIECTE_DE_INVENTAR,
                                'Amenajarii provizorii': ArticleType.AMENAJARI_PROVIZORII,
                                'Mat. spre prelucrare': ArticleType.MATERIALE_SPRE_PRELUCRARE,
                                'Mat. in pastrare/consig': ArticleType.MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE
                            };
    
                            console.log(`[DEBUG] Creating article: ${item.name} (code: ${item.articleCode}) for accounting relationship ${accountingClientRelation.id}`);
    
                            return prisma.article.create({
                                data: {
                                    code: item.articleCode,
                                    name: item.name,
                                    vat: item.vat,
                                    unitOfMeasure: item.um,
                                    type: typeMapping[item.type] || ArticleType.MARFURI,
                                    clientCompanyId: clientCompany.id,
                                    accountingClientId: accountingClientRelation.id 
                                }
                            });
                        });
    
                    const createdArticles = await Promise.all(articlePromises);
                    console.log(`[DEBUG] Successfully created ${createdArticles.length} articles for accounting relationship ${accountingClientRelation.id}`);
                } else {
                    console.log(`[DEBUG] No line items found or no new articles to create`);
                }
    
                console.log(`[AUDIT] Document ${document.id} created by user ${user.id} for company ${currentUser.accountingCompanyId} and client ${clientCompany.ein}`);
    
                return { savedDocument: document, savedProcessedData: processedDataDb };
            });
    
            return result;
    
        } catch (e) {
            if (uploadResult && fileKey) {
                try {
                    await s3.deleteObject({
                        Bucket: process.env.AWS_S3_BUCKET_NAME,
                        Key: fileKey
                    }).promise();
                } catch (s3Error) {
                    console.error('Failed to cleanup S3 file after database error:', s3Error);
                }
            }
            
            if (e instanceof NotFoundException || e instanceof UnauthorizedException) throw e;
            console.error('[POST_FILE_ERROR]', e);
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