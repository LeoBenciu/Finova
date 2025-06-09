import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserDto, User } from './dto';
import * as argon from 'argon2';
import * as AWS from 'aws-sdk';
import { Request } from 'express';

@Injectable()
export class UserService {
    constructor(private prisma: PrismaService){}

    async getMyDetails(user:User){
        try{
            const userDetails = await this.prisma.user.findUnique({
                where:{
                    id: user.id
                }
            })

            const accountingCompany = await this.prisma.accountingCompany.findUnique({
                where: {
                    id: userDetails.accountingCompanyId
                }
            })
            
            const uipathSubfolder = accountingCompany.uipathSubfolder;

            if(!userDetails) throw new NotFoundException('User not found in the database!');
    
            delete userDetails.hashPassword;
            return {
                ...userDetails,
                uipathSubfolder
            };
        }catch(e)
        {
            if( e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch user details!");
        }
    };

    async updateMyDetails(user: User, dto: UpdateUserDto)
    {
        try{
            const newUser = await this.prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    name: dto.name,
                    email: dto.email,
                    role: dto.role,
                    phoneNumber: dto.phoneNumber,
                }
            })
            delete newUser.hashPassword;
            return newUser;
        }
        catch(e)
        {
            if (e.code === 'P2002') {
                throw new ConflictException('Email already exists');
              }
              
              console.error('User update failed:', e);
              throw new InternalServerErrorException('Failed to update user details');
            
        }
    }

    async updateAccountPassword(password:string, user:User)
    {
        try {
            const hashedPassword = await argon.hash(password);
            const newUser = await this.prisma.user.update({
                where:{
                    id: user.id
                }, 
                data: {
                    hashPassword: hashedPassword
                }
            })

            delete newUser.hashPassword;
            return newUser;
        } catch (e) {
            console.error('Password update failed:', e)
            throw new InternalServerErrorException('Failed to update user password');
        }
    }

    private async deleteUserFilesFromS3(user: User): Promise<{ deletedFiles: number; errors: string[] }> {
        const s3 = new AWS.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION
        });

        let deletedFiles = 0;
        const errors: string[] = [];

        try {
            const userSpecificDocuments = await this.prisma.document.findMany({
                where: {
                    accountingClient: {
                        accountingCompanyId: user.accountingCompanyId
                    }
                },
                select: {
                    id: true,
                    s3Key: true,
                    name: true,
                    accountingClient: {
                        select: {
                            id: true,
                            accountingCompanyId: true,
                            clientCompany: {
                                select: {
                                    id: true,
                                    name: true,
                                    ein: true
                                }
                            }
                        }
                    }
                }
            });

            if (userSpecificDocuments.length === 0) {
                console.log(`No documents found for accounting company ${user.accountingCompanyId} to delete from S3`);
                return { deletedFiles: 0, errors: [] };
            }

            console.log(`Found ${userSpecificDocuments.length} documents to delete from S3 for accounting company ${user.accountingCompanyId}`);
            
            userSpecificDocuments.forEach(doc => {
                console.log(`Will delete: ${doc.name} (S3: ${doc.s3Key}) - Client: ${doc.accountingClient.clientCompany.name}`);
            });

            const clientIds = [...new Set(userSpecificDocuments.map(doc => doc.accountingClient.clientCompany.id))];
            
            for (const clientId of clientIds) {
                const otherAccountingCompanies = await this.prisma.accountingClients.findMany({
                    where: {
                        clientCompanyId: clientId,
                        accountingCompanyId: { not: user.accountingCompanyId }
                    },
                    include: {
                        accountingCompany: {
                            select: { name: true, ein: true }
                        },
                        clientCompany: {
                            select: { name: true, ein: true }
                        }
                    }
                });

                if (otherAccountingCompanies.length > 0) {
                    console.log(`Client ${clientId} also has relationships with ${otherAccountingCompanies.length} other accounting companies:`);
                    otherAccountingCompanies.forEach(relation => {
                        console.log(`  - ${relation.accountingCompany.name} (${relation.accountingCompany.ein})`);
                    });
                    console.log(`Their documents will NOT be affected by this deletion`);
                }
            }

            const BATCH_SIZE = 10;
            const batches = [];
            
            for (let i = 0; i < userSpecificDocuments.length; i += BATCH_SIZE) {
                batches.push(userSpecificDocuments.slice(i, i + BATCH_SIZE));
            }

            for (const batch of batches) {
                const deletePromises = batch.map(async (doc) => {
                    try {
                        await s3.deleteObject({
                            Bucket: process.env.AWS_S3_BUCKET_NAME,
                            Key: doc.s3Key
                        }).promise();
                        
                        deletedFiles++;
                        console.log(`Deleted S3 file: ${doc.s3Key}`);
                        console.log(`   Document: ${doc.name}`);
                        console.log(`   Client: ${doc.accountingClient.clientCompany.name} (${doc.accountingClient.clientCompany.ein})`);
                        console.log(`   Accounting Company: ${user.accountingCompanyId}`);
                        
                    } catch (error) {
                        const errorMsg = `Failed to delete S3 file ${doc.s3Key}: ${error.message}`;
                        errors.push(errorMsg);
                        console.error(errorMsg);
                    }
                });

                await Promise.allSettled(deletePromises);
                
                if (batches.indexOf(batch) < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            await this.cleanupSpecificOrphanedFiles(user.accountingCompanyId, userSpecificDocuments, s3);

            return { deletedFiles, errors };

        } catch (error) {
            const errorMsg = `Critical error in S3 deletion process: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
            return { deletedFiles, errors };
        }
    }

    private async cleanupSpecificOrphanedFiles(
        accountingCompanyId: number, 
        deletedDocuments: any[], 
        s3: AWS.S3
    ): Promise<void> {
        try {
            const expectedS3Keys = new Set(deletedDocuments.map(doc => doc.s3Key));
            
            const prefix = `${accountingCompanyId}/`;
            
            const listParams = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Prefix: prefix
            };

            const listedObjects = await s3.listObjectsV2(listParams).promise();
            
            if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
                console.log(`No files found with prefix ${prefix} for cleanup`);
                return;
            }

            const orphanedKeys: string[] = [];
            
            for (const s3Object of listedObjects.Contents) {
                if (s3Object.Key && !expectedS3Keys.has(s3Object.Key)) {
                    const existsInDb = await this.prisma.document.findFirst({
                        where: { s3Key: s3Object.Key }
                    });
                    
                    if (!existsInDb) {
                        orphanedKeys.push(s3Object.Key);
                    }
                }
            }

            if (orphanedKeys.length === 0) {
                console.log(`No orphaned files found for accounting company ${accountingCompanyId}`);
                return;
            }

            const deleteParams = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Delete: {
                    Objects: orphanedKeys.map(key => ({ Key: key }))
                }
            };

            const deleteResult = await s3.deleteObjects(deleteParams).promise();
            
            if (deleteResult.Deleted && deleteResult.Deleted.length > 0) {
                console.log(`Cleaned up ${deleteResult.Deleted.length} orphaned files for accounting company ${accountingCompanyId}`);
                deleteResult.Deleted.forEach(deleted => {
                    console.log(`   Orphaned file: ${deleted.Key}`);
                });
            }
            
            if (deleteResult.Errors && deleteResult.Errors.length > 0) {
                console.error(`Errors during cleanup:`, deleteResult.Errors);
            }

        } catch (error) {
            console.error(`Failed to cleanup orphaned S3 files for company ${accountingCompanyId}: ${error.message}`);
        }
    }

    
    async deleteMyAccount(user: User, req?: Request) {
        try {
            const userToDelete = await this.prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    accountingCompany: {
                        include: {
                            users: true,
                            accountingClients: {
                                include: {
                                    documents: true,
                                    rpaActions: true,
                                    clientCompany: {
                                        include: {
                                            accountingClients: {
                                                where: {
                                                    accountingCompanyId: { not: user.accountingCompanyId }
                                                },
                                                include: {
                                                    accountingCompany: {
                                                        select: { name: true, ein: true }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    legalAgreements: true,
                    rpaActionsTriggered: true
                }
            });
    
            if (!userToDelete) {
                throw new NotFoundException('User doesn\'t exist');
            }
    
            const isOnlyUserInCompany = userToDelete.accountingCompany.users.length === 1;
            
            console.log(`User ${user.id} deletion analysis:`);
            console.log(`- Accounting Company: ${userToDelete.accountingCompany.name} (ID: ${userToDelete.accountingCompanyId})`);
            console.log(`- Users in company: ${userToDelete.accountingCompany.users.length}`);
            console.log(`- Is only user: ${isOnlyUserInCompany}`);
            console.log(`- Will delete S3 files: ${isOnlyUserInCompany}`);
    
            let s3DeletionResult = { deletedFiles: 0, errors: [] };
            
            if (isOnlyUserInCompany) {
                console.log('Starting S3 files deletion - user is the last in company');
                s3DeletionResult = await this.deleteUserFilesFromS3(user);
                
                console.log(`S3 Deletion Summary: ${s3DeletionResult.deletedFiles} files deleted`);
                if (s3DeletionResult.errors.length > 0) {
                    console.warn(`S3 Deletion Warnings:`, s3DeletionResult.errors);
                }
            } else {
                console.log('Skipping S3 deletion - other users exist in the company');
                console.log(`${userToDelete.accountingCompany.accountingClients.reduce((total, client) => total + client.documents.length, 0)} documents will be preserved for remaining users`);
            }
    
            const auditLog = {
                userId: user.id,
                email: userToDelete.email,
                accountingCompanyId: userToDelete.accountingCompanyId,
                deletedAt: new Date(),
                ipAddress: req?.ip || 'unknown',
                userAgent: req?.headers['user-agent'] || 'unknown',
                reason: 'USER_INITIATED_DELETION',
                isOnlyUserInCompany,
                s3FilesDeleted: s3DeletionResult.deletedFiles,
                s3DeletionSkipped: !isOnlyUserInCompany
            };
    
            const result = await this.prisma.$transaction(async (prisma) => {
                const deletionSummary = {
                    userId: user.id,
                    email: userToDelete.email,
                    accountingCompanyId: userToDelete.accountingCompanyId,
                    isOnlyUserInCompany,
                    deletedData: {
                        legalAgreements: 0,
                        rpaActions: 0,
                        documents: 0,
                        s3Files: s3DeletionResult.deletedFiles,
                        accountingCompanyDeleted: false,
                        clientRelationshipsAffected: 0
                    },
                    preservedData: {
                        documentsPreserved: 0,
                        usersRemaining: 0
                    }
                };
    
    
                const deletedAgreements = await prisma.legalAgreement.deleteMany({
                    where: { userId: user.id }
                });
                deletionSummary.deletedData.legalAgreements = deletedAgreements.count;
    
                const deletedRpaActions = await prisma.rpaAction.deleteMany({
                    where: { triggeredById: user.id }
                });
                deletionSummary.deletedData.rpaActions = deletedRpaActions.count;
    
                if (isOnlyUserInCompany) {
                    console.log('Deleting all company data - last user');
                    
                    const accountingClientIds = userToDelete.accountingCompany.accountingClients.map(ac => ac.id);
                    
                    if (accountingClientIds.length > 0) {
                        await prisma.processedData.deleteMany({
                            where: {
                                document: {
                                    accountingClientId: { in: accountingClientIds }
                                }
                            }
                        });
                        
                        const deletedDocs = await prisma.document.deleteMany({
                            where: { accountingClientId: { in: accountingClientIds } }
                        });
                        deletionSummary.deletedData.documents = deletedDocs.count;
    
                        await prisma.rpaAction.deleteMany({
                            where: { accountingClientId: { in: accountingClientIds } }
                        });
    
                        const deletedRelations = await prisma.accountingClients.deleteMany({
                            where: { accountingCompanyId: userToDelete.accountingCompanyId }
                        });
                        deletionSummary.deletedData.clientRelationshipsAffected = deletedRelations.count;
                    }
    
                    const deletedUser = await prisma.user.delete({
                        where: { id: user.id }
                    });
    
                    await prisma.accountingCompany.delete({
                        where: { id: userToDelete.accountingCompanyId }
                    });
    
                    deletionSummary.deletedData.accountingCompanyDeleted = true;
                    delete deletedUser.hashPassword;
                    
                    return { deletedUser, deletionSummary, auditLog };
    
                } else {
                    console.log('Preserving company data - other users exist');
                    
                    const totalDocuments = userToDelete.accountingCompany.accountingClients
                        .reduce((total, client) => total + client.documents.length, 0);
                    
                    deletionSummary.preservedData.documentsPreserved = totalDocuments;
                    deletionSummary.preservedData.usersRemaining = userToDelete.accountingCompany.users.length - 1;
                    
                    console.log(`Preserving ${totalDocuments} documents for ${deletionSummary.preservedData.usersRemaining} remaining users`);
    
                    const deletedUser = await prisma.user.delete({
                        where: { id: user.id }
                    });
    
                    delete deletedUser.hashPassword;
                    
                    return { deletedUser, deletionSummary, auditLog };
                }
            });
    
            console.log('GDPR Account Deletion Completed:', {
                userId: result.deletionSummary.userId,
                email: result.deletionSummary.email,
                companyDeleted: result.deletionSummary.deletedData.accountingCompanyDeleted,
                documentsDeleted: result.deletionSummary.deletedData.documents,
                documentsPreserved: result.deletionSummary.preservedData.documentsPreserved,
                s3FilesDeleted: result.deletionSummary.deletedData.s3Files,
                usersRemaining: result.deletionSummary.preservedData.usersRemaining
            });
    
            return {
                message: isOnlyUserInCompany 
                    ? 'Account and all company data deleted successfully'
                    : 'Personal account deleted successfully. Company data preserved for remaining users.',
                deletionSummary: result.deletionSummary,
                s3DeletionSummary: {
                    filesDeleted: s3DeletionResult.deletedFiles,
                    errors: s3DeletionResult.errors,
                    skipped: !isOnlyUserInCompany,
                    reason: !isOnlyUserInCompany ? 'Other users exist in company' : null
                }
            };
    
        } catch (e) {
            if (e instanceof NotFoundException) throw e;
            console.error('GDPR Account deletion failed:', e);
            throw new InternalServerErrorException("Failed to delete user account and associated data!");
        }
    }


    async getUserAgreements(user: User) {
        try {
            const agreements = await this.prisma.legalAgreement.findMany({
                where: { userId: user.id },
                orderBy: { acceptedAt: 'desc' }
            });
    
            const agreementMap = agreements.reduce((acc, agreement) => {
                acc[agreement.agreementType] = {
                    accepted: agreement.accepted,
                    acceptedAt: agreement.acceptedAt,
                    version: agreement.version
                };
                return acc;
            }, {});
    
            const allAgreements = {
                terms: agreementMap['terms'] || { accepted: false, acceptedAt: null, version: null },
                privacy: agreementMap['privacy'] || { accepted: false, acceptedAt: null, version: null },
                dpa: agreementMap['dpa'] || { accepted: false, acceptedAt: null, version: null },
                cookies: agreementMap['cookies'] || { accepted: false, acceptedAt: null, version: null },
                marketing: agreementMap['marketing'] || { accepted: false, acceptedAt: null, version: null }
            };
    
            return allAgreements;
        } catch (e) {
            console.error('Failed to fetch user agreements:', e);
            throw new InternalServerErrorException('Failed to fetch legal agreements');
        }
    }
    
    async updateUserConsent(user: User, agreementType: string, accepted: boolean, req?: Request) {
        try {
            const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
            const userAgent = req?.headers['user-agent'] || null;
    
            const agreement = await this.prisma.legalAgreement.upsert({
                where: {
                    userId_agreementType: {
                        userId: user.id,
                        agreementType: agreementType
                    }
                },
                update: {
                    accepted: accepted,
                    acceptedAt: new Date(),
                    ipAddress,
                    userAgent
                },
                create: {
                    userId: user.id,
                    agreementType: agreementType,
                    accepted: accepted,
                    ipAddress,
                    userAgent,
                    version: '1.0'
                }
            });
    
            return {
                success: true,
                agreement,
                message: `${agreementType} consent updated successfully`
            };
        } catch (e) {
            console.error('Failed to update consent:', e);
            throw new InternalServerErrorException('Failed to update consent');
        }
    }

    async updateUipathSubfolder(user:User, folderName: string)
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
                    uipathSubfolder: folderName
                }
            });
    
            return accountingCompany;
        } catch (e) {
            console.error('Failed to update subfolder:', e);
            throw new InternalServerErrorException('Failed to update subfolder');
        }        
    }
}
