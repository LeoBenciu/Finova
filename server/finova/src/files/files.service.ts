import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as AWS from 'aws-sdk';

@Injectable()
export class FilesService {

    constructor(private prisma: PrismaService){}
    
    getFiles()
    {
        
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

    updateFiles()
    {

    }

    deleteFiles()
    {
        
    }
}
