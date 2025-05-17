import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientCompanyDto, DeleteClientCompanyDto, NewManagementDto } from './dto';
import { AnafService } from 'src/anaf/anaf.service';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { User, UnitOfMeasure, ArticleType, ManagementType, VatRate} from '@prisma/client';

@Injectable()
export class ClientCompaniesService {
    private readonly logger = new Logger(ClientCompaniesService.name);

    constructor(private prisma:PrismaService, private anaf:AnafService){}

    async getClientCompany(clientId: number, reqUser: User)
    {
        try
        {
            const user = await this.prisma.user.findUnique({
                where:{
                    id: reqUser.id
                }
            });
            if(!user) throw new NotFoundException('User not found in the database!');

            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    id: clientId,
                    accountingClients:{
                        some:{
                            accountingCompanyId: user.accountingCompanyId,
                        }
                    }
                }
            });

            if(!clientCompany) throw new NotFoundException("Client company not found!")

            return clientCompany;
        }
        catch(e)
        {
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch client company");
        }
    }

    async getClientCompanies(reqUser:User)
    {
       try
        { 
        const user = await this.prisma.user.findUnique({
            where:{
                id: reqUser.id
            }
        });
        if(!user) throw new NotFoundException("User not found in the database!");

        const accountingClients = await this.prisma.accountingClients.findMany({
            where:{
                accountingCompanyId: user.accountingCompanyId
            }
        });

        if(accountingClients.length===0) throw new NotFoundException("There are no clients created for this accounting company!");

        const clientCompaniesIds = accountingClients.map(client=>client.clientCompanyId);

        const clientCompanies = await this.prisma.clientCompany.findMany({
            where:{
                id: {
                    in: clientCompaniesIds
                }
            }
        });

        return clientCompanies;
        }
        catch(e){
            if (e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException("Failed to fetch client companies");
        }
    }

    async createClientCompany(ein:{ein:string}, reqUser: User, articlesFile: Express.Multer.File, managementFile: Express.Multer.File)
    {
        try
        {
            this.logger.log('Starting client company creation');

            if (!articlesFile || !managementFile) {
                this.logger.error('Missing required files');
                throw new BadRequestException('Both articles and management CSV files are required');
            };

            this.logger.log('Files validated, checking mime types');

            if (articlesFile.mimetype !== 'text/csv' || managementFile.mimetype !== 'text/csv') {
                throw new BadRequestException('Only CSV files are allowed');
            };

            this.logger.debug(`Articles file content: ${fs.readFileSync(articlesFile.path, 'utf8')}`);
            this.logger.debug(`Management file content: ${fs.readFileSync(managementFile.path, 'utf8')}`);

            const articleColumns = ['cod','denumire','um', 'tva', 'den_tip', 'stoc', 'grupa', 'is_valuta'];
            const managementColumns = ['cod', 'denumire', 'tip_gestiune', 'gestionar', 'tip_eval', 'glob_371', 'glob_378',
                'glob_4428', 'glob_607', 'glob_707', 'proctva'];
            
            await this.validateCsvHeaders(articlesFile, articleColumns);
            await this.validateCsvHeaders(managementFile, managementColumns);

            const articlesRows = await this.parseCsv(articlesFile);
            const managementRows = await this.parseCsv(managementFile);
            
            this.logger.log(`Successfully parsed ${articlesRows.length} articles and ${managementRows.length} management rows`);

            const vatMap: Record<string, string> = {
                '0': 'ZERO',
                '19': 'NINETEEN',
                '9': 'NINE',
                '5': 'FIVE'
              };
              
              const unitOfMeasureMap: Record<string, string> = {
                buc: 'BUCATA',
                kg: 'KILOGRAM',
                litri: 'LITRU',
                m: 'METRU',
                grame: 'GRAM',
                cutii: 'CUTIE',
                pac: 'PACHET',
                pungi: 'PUNGA',
                set: 'SET',
                mp: 'METRU_PATRAT',
                mc: 'METRU_CUB',
                mm: 'MILIMETRU',
                cm: 'CENTIMETRU',
                tone: 'TONA',
                per: 'PERECHE',
                saci: 'SAC',
                ml: 'MILILITRU',
                kwh: 'KILOWATT_ORA',
                mn: 'MINUT',
                ore: 'ORA',
                zile: 'ZI_DE_LUCRU',
                luni: 'LUNI_DE_LUCRU',
                doze: 'DOZA',
                serv: 'UNITATE_DE_SERVICE',
                "1000b": 'O_MIE_DE_BUCATI',
                trim: 'TRIMESTRU',
                proc: 'PROCENT',
                km: 'KILOMETRU',
                lada: 'LADA',
                dt: 'DRY_TONE',
                cmp: 'CENTIMETRU_PATRAT',
                mwh: 'MEGAWATI_ORA',
                rola: 'ROLA',
                tamb: 'TAMBUR',
                sac: 'SAC_PLASTIC',
                palet: 'PALET_LEMN',
                unit: 'UNITATE',
                tn: 'TONA_NETA',
                ha: 'HECTOMETRU_PATRAT',
                foaie: 'FOAIE'
              };
              
              const articleTypeMap: Record<string, string> = {
                marfuri: 'MARFURI',
                materiiPrime: 'MATERII_PRIME',
                produseFinite: 'PRODUSE_FINITE',
                semifabricate: 'SEMIFABRICATE',
                discountFinancialIesiri: 'DISCOUNT_FINANCIAL_IESIRI',
                discountComercialIesiri: 'DISCOUNT_COMERCIAL_IESIRI',
                serviciiVandute: 'SERVICII_VANDUTE',
                materialeAuxiliare: 'MATERIALE_AUXILIARE',
                ambalaje: 'AMBALAJE',
                taxaVerde: 'TAXA_VERDE', 
                obiecteDeInventar: 'OBIECTE_DE_INVENTAR',
                amenajariProvizorii: 'AMENAJARI_PROVIZORII',
                materialeSprePrelucrare: 'MATERIALE_SPRE_PRELUCRARE',
                materialeInPastrareSauConsignatie: 'MATERIALE_IN_PASTRARE_SAU_CONSIGNATIE',
                discountFinancialIntrari: 'DISCOUNT_FINANCIAL_INTRARI',
                combustibili: 'COMBUSTIBILI',
                pieseDeSchimb: 'PIESE_DE_SCHIMB',
                alteMaterialeConsumabile: 'ALTE_MATERIALE_CONSUMABILE',
                discountComercialIntrari: 'DISCOUNT_COMERCIAL_INTRARI',
                ambalajeSgr: 'AMBALAJE_SGR'
              };

            const managementTypeMap: Record<string, string> = {
              'cantitativ-valorica': ManagementType.CANTITATIV_VALORIC,
              'cantitativ_valorica': ManagementType.CANTITATIV_VALORIC,
              'global-valorica': ManagementType.GLOBAL_VALORIC,
              'global_valorica': ManagementType.GLOBAL_VALORIC,
            };

            const articleData = articlesRows.length > 0 ? articlesRows.map((row, index) => {
              const code = parseInt(row.cod);
              if (isNaN(code) || !row.cod) {
                throw new BadRequestException(`Invalid or missing code in articles.csv at row ${index + 2}`);
              }
              if (!row.denumire) {
                throw new BadRequestException(`Missing name in articles.csv at row ${index + 2}`);
              }
              const vat = vatMap[row.tva?.toLowerCase()];
              if (!vat) {
                throw new BadRequestException(`Invalid vat '${row.tva}' in articles.csv at row ${index + 2}`);
              }
              const unitOfMeasure = unitOfMeasureMap[row.um?.toLowerCase()] || row.um?.toUpperCase();
              if (!Object.values(UnitOfMeasure).includes(unitOfMeasure)) {
                throw new BadRequestException(`Invalid unitOfMeasure '${row.um}' in articles.csv at row ${index + 2}`);
              }
              const type = articleTypeMap[row.den_tip?.toLowerCase()] || row.den_tip?.toUpperCase();
              if (!Object.values(ArticleType).includes(type)) {
                throw new BadRequestException(`Invalid type '${row.den_tip}' in articles.csv at row ${index + 2}`);
              }
              return {
                code,
                name: row.denumire,
                vat: vat as VatRate,
                unitOfMeasure,
                type,
              };
            }) : [];
              
            const managementData = managementRows.length > 0 ? managementRows.map((row, index) => {
              const code = parseInt(row.cod);
              if (isNaN(code) || !row.cod) {
                throw new BadRequestException(`Invalid or missing code in management.csv at row ${index + 2}`);
              }
              if (!row.denumire) {
                throw new BadRequestException(`Missing name in management.csv at row ${index + 2}`);
              }
              const type = managementTypeMap[row.tip_gestiune?.toLowerCase()] || row.tip_gestiune?.toUpperCase();
              if (!Object.values(ManagementType).includes(type)) {
                throw new BadRequestException(`Invalid type '${row.tip_gestiune}' in management.csv at row ${index + 2}`);
              }
              const vatRate = vatMap[row.proctva?.toLowerCase()];
              if (!vatRate) {
                throw new BadRequestException(`Invalid vatRate '${row.proctva}' in management.csv at row ${index + 2}`);
              }
              return {
                code,
                name: row.denumire,
                type,
                manager: row.gestionar || null,
                isSellingPrice: row.tip_eval === 'true' || row.tip_eval === '1',
                analitic371: row.glob_371 || null,
                analitic378: row.glob_378 || null,
                analitic4428: row.glob_4428 || null,
                analitic607: row.glob_607 || null,
                analitic707: row.glob_707 || null,
                vatRate: vatRate as VatRate,
              };
            }) : [];
            
            if (articleData.length > 0) {
              const articleCodeCounts = articleData.reduce((acc, a) => {
                acc[a.code] = (acc[a.code] || 0) + 1;
                return acc;
              }, {} as Record<number, number>);
              const articleDuplicates = Object.keys(articleCodeCounts)
                .filter((code) => articleCodeCounts[parseInt(code)] > 1)
                .map((code) => parseInt(code));
              if (articleDuplicates.length) {
                throw new BadRequestException(`Duplicate cod values in articles.csv: ${articleDuplicates.join(', ')}`);
              }
            }
          
            if (managementData.length > 0) {
              const managementCodeCounts = managementData.reduce((acc, m) => {
                acc[m.code] = (acc[m.code] || 0) + 1;
                return acc;
              }, {} as Record<number, number>);
              const managementDuplicates = Object.keys(managementCodeCounts)
                .filter((code) => managementCodeCounts[parseInt(code)] > 1)
                .map((code) => parseInt(code));
              if (managementDuplicates.length) {
                throw new BadRequestException(`Duplicate cod values in management.csv: ${managementDuplicates.join(', ')}`);
              }
            }

            const user = await this.prisma.user.findUnique({
              where: { id: reqUser.id },
            });

            if (!user) throw new NotFoundException('User not found in the database!');
        
            const companyData = await this.anaf.getCompanyDetails(ein.ein);
            if (!companyData) throw new NotFoundException("Company doesn't exist");
        
            const result = await this.prisma.$transaction(async (prisma) => {

              const newCompany = await prisma.clientCompany.upsert({
                where: { ein: String(companyData.date_generale.cui) },
                update: {},
                create: {
                  name: companyData.date_generale.denumire,
                  ein: String(companyData.date_generale.cui),
                },
              });
        
              const existingLink = await prisma.accountingClients.findFirst({
                where: {
                  accountingCompanyId: user.accountingCompanyId,
                  clientCompanyId: newCompany.id,
                },
              });
        
              let link;
              if (!existingLink) {
                link = await prisma.accountingClients.create({
                  data: {
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: newCompany.id,
                  },
                });
              }
        
              let articleResult = { count: 0 };
              if (articleData.length > 0) {
                articleResult = await prisma.article.createMany({
                  data: articleData.map((data) => ({
                    ...data,
                    clientCompanyId: newCompany.id,
                  })),
                  skipDuplicates: true,
                });
              }
        
              let managementResult = { count: 0 };
              if (managementData.length > 0) {
                managementResult = await prisma.management.createMany({
                  data: managementData.map((data) => ({
                    ...data,
                    clientCompanyId: newCompany.id,
                  })),
                  skipDuplicates: true,
                });
              }
        
              return {
                company: newCompany,
                link,
                articleCount: articleResult.count,
                managementCount: managementResult.count,
              };
            });
        
            this.logger.log(`Created company with EIN ${ein.ein}, ${result.articleCount} articles, ${result.managementCount} management records`);
        
            return {
              company: { ein: result.company.ein, name: result.company.name },
              articleCount: result.articleCount,
              managementCount: result.managementCount,
              message: result.link ? 'Company and link created' : 'Company already linked',
            };
          } catch (e) {
            this.logger.error(`Error creating client company with EIN ${ein.ein}: ${e.message}`, e.stack);
            console.error('Full error object:', JSON.stringify(e, null, 2));
            if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
            throw new InternalServerErrorException('Failed to create client company');
          } finally {
            try {
              if (articlesFile && fs.existsSync(articlesFile.path)) {
                fs.unlinkSync(articlesFile.path);
              }
              if (managementFile && fs.existsSync(managementFile.path)) {
                fs.unlinkSync(managementFile.path);
              }
            } catch (err) {
              this.logger.error(`Failed to delete temporary files: ${err.message}`);
            }
          }
        }

    private async validateCsvHeaders(file: Express.Multer.File, expectedColumns: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            let headersChecked = false;
            const parser = parse({columns: true, delimiter: ',', trim: true});
            
            fs.createReadStream(file.path)
                .pipe(parser)
                .on('headers', (headers) => {
                    headersChecked = true;
                    if (!expectedColumns.every((col) => headers.includes(col))) {
                        reject(
                            new BadRequestException(
                                `Missing required columns in ${file.originalname}: ${expectedColumns.join(', ')}`,
                            ),
                        );
                    } else {
                        resolve();
                    }
                })
                .on('end', () => {
                    if (!headersChecked) {
                        reject(
                            new BadRequestException(
                                `Failed to parse headers in ${file.originalname}`,
                            ),
                        );
                    }
                })
                .on('error', (err) =>
                    reject(new InternalServerErrorException(`Failed to parse ${file.originalname}: ${err.message}`))
                );
        });
    }

    private async parseCsv(file: Express.Multer.File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const results: any[] = [];
            fs.createReadStream(file.path)
                .pipe(parse({
                    columns: true,
                    trim: true,
                    skip_empty_lines: true,
                    delimiter: ',',
                }))
                .on('data', (row) => results.push(row))
                .on('end', () => {
                    resolve(results);
                })
                .on('error', (err) => 
                    reject(new InternalServerErrorException(`Failed to parse ${file.originalname}: ${err.message}`)),
                );
        });
    }

    async deleteClientCompany(dto:DeleteClientCompanyDto,reqUser: User)
    {
        try{
            const user = await this.prisma.user.findUnique({
                where:{
                    id: reqUser.id
                }
            });

            const clientCompany = await this.prisma.clientCompany.findUnique({
                where:{
                    ein: dto.ein
                }
            });
            if(!clientCompany) throw new NotFoundException(`We could't find the company with ${dto.ein} in the database`);
    
            const deletedLink  = await this.prisma.accountingClients.deleteMany({
                where:{
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: clientCompany.id
                }
            })
            if(deletedLink.count ===1) 
            {
                return clientCompany
            }else{
                throw new NotFoundException("No client with this ein is linked to the company!")
            };
            
        }
        catch(e)
        {
            console.error('error :',e);
            return e;
        }
    }

    async saveNewManagement(dto: NewManagementDto)
    {
      try {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where:{
            ein: dto.currentClientCompanyEin
          }
        });
        let type:ManagementType;
        switch(dto.type){
          case 'GLOBAL_VALORIC':
            type = ManagementType.GLOBAL_VALORIC;
          case 'CANTITATIV_VALORIC':
            type = ManagementType.CANTITATIV_VALORIC;
        };

        let vatRate: VatRate;
        switch(dto.vatRate){
          case 'ZERO':
            vatRate = VatRate.ZERO;
          case 'FIVE':
            vatRate = VatRate.FIVE;
          case 'NINE':
            vatRate = VatRate.NINE;
          case 'NINETEEN':
            vatRate = VatRate.NINETEEN;
        };

        const newManagement = await this.prisma.management.create({
          data:{
            clientCompanyId: clientCompany.id,
            code: dto.code,
            name: dto.name,
            type: type,
            manager: dto.manager,
            isSellingPrice: dto.isSellingPrice,
            vatRate: vatRate
          }
        });

        if( !newManagement ) throw new InternalServerErrorException('Failed to create new management, please try again later!');

        return newManagement;

      } catch (e) {
        console.error('Error creating a new management:', e );
        return e;
      }
    }

    async getCompanyData(currentCompanyEin: string, reqUser: User, year: string) {
      try {
        const clientCompany = await this.prisma.clientCompany.findUnique({
          where: {
            ein: currentCompanyEin
          }
        });
    
        if (!clientCompany) throw new NotFoundException('Client company not found in the database');
    
        const user = await this.prisma.user.findUnique({
          where: {
            id: reqUser.id
          }
        });
    
        if (!user) throw new NotFoundException('Not found user in the database');
    
        const accountingClient = await this.prisma.accountingClients.findMany({
          where: {
            accountingCompanyId: user.accountingCompanyId,
            clientCompanyId: clientCompany.id
          }
        });
    
        if (accountingClient.length === 0) throw new UnauthorizedException("Sorry! You don't have access to this data");
    
        const documents = await this.prisma.document.findMany({
          where: {
            accountingClientId: accountingClient[0].id
          }
        });
    
        if (documents.length === 0) throw new NotFoundException('There are no documents processed for this company so there is no data in the database');
    
        const processedData = await this.prisma.processedData.findMany({
          where: {
            documentId: {
              in: documents.map(doc => doc.id)
            }
          }
        });
    
        let incomeLastMonth: number = 0;
        let expensesLastMonth: number = 0;
        let incomeCurrentMonth: number = 0;
        let expensesCurrentMonth: number = 0;
        let now = new Date();
        let currentMonth = now.toLocaleDateString('en-GB').split('/').join('-').slice(3, 5);
        let currentYear = now.toLocaleDateString('en-GB').split('/').join('-').slice(6);
    
        const monthlyData = Array(12).fill(0).map((_, i) => ({
          month: i + 1,
          monthName: new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }),
          income: 0,
          expenses: 0
        }));
    
        processedData.forEach((docData) => {
          const extractedData = docData.extractedFields as {
            result: {
              buyerEin: string,
              total_amount: number,
              vat_amount: number,
              document_date: string
            }
          };
    
          const docYear = extractedData.result.document_date.split('/')[2] ||
            extractedData.result.document_date.slice(6);
    
          if (year && docYear !== year) {
            return;
          }
    
          const docMonth = extractedData.result.document_date.split('/')[1] ||
            extractedData.result.document_date.slice(3, 5);
          
          const docMonthIndex = Number(docMonth) - 1;
          
          const amountWithoutVat = extractedData.result.total_amount - extractedData.result.vat_amount;
    
          if (extractedData.result.buyerEin === currentCompanyEin) {
            if (Number(docMonth) === Number(currentMonth) - 1) {
              expensesLastMonth += amountWithoutVat;
            } else if (Number(docMonth) === Number(currentMonth)) {
              expensesCurrentMonth += amountWithoutVat;
            }
            
            if (docMonthIndex >= 0 && docMonthIndex < 12) {
              monthlyData[docMonthIndex].expenses += amountWithoutVat;
            }
          } else {
            if (Number(docMonth) === Number(currentMonth) - 1) {
              incomeLastMonth += amountWithoutVat;
            } else if (Number(docMonth) === Number(currentMonth)) {
              incomeCurrentMonth += amountWithoutVat;
            }
            
            if (docMonthIndex >= 0 && docMonthIndex < 12) {
              monthlyData[docMonthIndex].income += amountWithoutVat;
            }
          }
        });
    
        return {
          incomeLastMonth,
          expensesLastMonth,
          incomeCurrentMonth,
          expensesCurrentMonth,
          graphData: {
            monthlyData
          },
          rpaProcesses: 'here'
        }
      } catch (e) {
        console.error('Not found company data in the database:', e);
        return e;
      }
    }
}