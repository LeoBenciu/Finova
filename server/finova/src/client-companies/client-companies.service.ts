import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateClientCompanyDto, DeleteClientCompanyDto, NewManagementDto } from './dto';
import { AnafService } from 'src/anaf/anaf.service';
import { FinancialMetricsService } from 'src/accounting/financial-metrics.service';
import * as fs from 'fs';
import { parse } from 'csv-parse';
import { User, UnitOfMeasure, ArticleType, ManagementType, VatRate} from '@prisma/client';

@Injectable()
export class ClientCompaniesService {
    private readonly logger = new Logger(ClientCompaniesService.name);

    constructor(
        private prisma: PrismaService, 
        private anaf: AnafService,
        private financialMetricsService: FinancialMetricsService
    ) {}

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

            if (articlesFile.mimetype !== 'text/csv' && articlesFile.mimetype !== 'application/vnd.ms-excel') {
                throw new BadRequestException('Articles file must be a CSV file');
            };
            
            if (managementFile.mimetype !== 'text/csv' && managementFile.mimetype !== 'application/vnd.ms-excel') {
                throw new BadRequestException('Management file must be a CSV file');
            };

            const articlesContent = fs.readFileSync(articlesFile.path, 'utf8');
            const managementContent = fs.readFileSync(managementFile.path, 'utf8');
            
            this.logger.debug(`Articles file content: ${articlesContent}`);
            this.logger.debug(`Management file content: ${managementContent}`);

            const requiredArticleColumns = ['cod', 'denumire', 'um', 'tva', 'den_tip'];
            const requiredManagementColumns = ['cod', 'denumire', 'tip_gestiune', 'proctva'];
            
            let articlesRows;
            let managementRows;
            
            try {
                this.logger.log('Parsing articles CSV file...');
                articlesRows = await this.parseCsv(articlesFile);
                this.logger.log(`Successfully parsed ${articlesRows.length} articles`);
                
                this.logger.log('Parsing management CSV file...');
                managementRows = await this.parseCsv(managementFile);
                this.logger.log(`Successfully parsed ${managementRows.length} management rows`);
                
                if (articlesRows.length > 0) {
                    const firstArticleRow = articlesRows[0];
                    for (const requiredCol of requiredArticleColumns) {
                        if (!(requiredCol in firstArticleRow)) {
                            throw new BadRequestException(`Missing required column '${requiredCol}' in articles CSV`);
                        }
                    }
                } else {
                    this.logger.warn('No article rows parsed');
                }
                
                if (managementRows.length > 0) {
                    const firstManagementRow = managementRows[0];
                    for (const requiredCol of requiredManagementColumns) {
                        if (!(requiredCol in firstManagementRow)) {
                            throw new BadRequestException(`Missing required column '${requiredCol}' in management CSV`);
                        }
                    }
                } else {
                    this.logger.warn('No management rows parsed');
                }
                
            } catch (error) {
                this.logger.error(`Error parsing CSV: ${error.message}`);
                throw new BadRequestException(`Error parsing CSV files: ${error.message}`);
            }
            
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
                materiiprime: 'MATERII_PRIME',
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

            const normalizeVatValue = (vatValue: string): string => {
              if (!vatValue) return '19';
              
              vatValue = String(vatValue).trim();
              
              try {
                const numValue = parseFloat(vatValue);
                if (!isNaN(numValue)) {
                  return Math.floor(numValue).toString();
                }
              } catch (e) {
              }
              
              return vatValue;
            };

            const articleData = articlesRows.length > 0 ? articlesRows.map((row, index) => {
              this.logger.debug(`Processing article row ${index + 1}: ${JSON.stringify(row)}`);
              
                const code = row.cod?.toString().trim();
  
                  if (!code || code === '') {
                    throw new BadRequestException(`Invalid or missing code in articles.csv at row ${index + 2}`);
                  }
                  if (!row.denumire) {
                    throw new BadRequestException(`Missing name in articles.csv at row ${index + 2}`);
                  }

                  const vatValue = normalizeVatValue(row.tva);
                  const vat = vatMap[vatValue];
                  if (!vat) {
                    throw new BadRequestException(`Invalid vat '${row.tva}' in articles.csv at row ${index + 2}`);
                  }

                  const umValue = row.um?.trim().toLowerCase() || 'buc';
                  const unitOfMeasure = unitOfMeasureMap[umValue] || UnitOfMeasure.BUCATA;

                  const typeValue = row.den_tip?.trim().toLowerCase() || 'marfuri';
                  const type = articleTypeMap[typeValue] || ArticleType.MARFURI;

                  return {
                    code, 
                    name: row.denumire.trim(),
                    vat: vat as VatRate,
                    unitOfMeasure,
                    type,
                  };
                }) : [];
              
            const managementData = managementRows.length > 0 ? managementRows.map((row, index) => {
              this.logger.debug(`Processing management row ${index + 1}: ${JSON.stringify(row)}`);
              
              const code = row.cod?.toString().trim();
              if (!code || code === '') {
                throw new BadRequestException(`Invalid or missing code in management.csv at row ${index + 2}`);
              }
              if (!row.denumire) {
                throw new BadRequestException(`Missing name in management.csv at row ${index + 2}`);
              }
              
              const typeValue = row.tip_gestiune?.trim().toLowerCase() || 'cantitativ_valorica';
              const type = managementTypeMap[typeValue] || ManagementType.CANTITATIV_VALORIC;
              
              const vatRateValue = normalizeVatValue(row.proctva);
              const vatRate = vatMap[vatRateValue];
              if (!vatRate) {
                throw new BadRequestException(`Invalid vatRate '${row.proctva}' in management.csv at row ${index + 2}`);
              }
              
              return {
                code, 
                name: row.denumire.trim(),
                type,
                manager: row.gestionar?.trim() || null,
                isSellingPrice: row.tip_eval === 'true' || row.tip_eval === '1',
                analitic371: row.glob_371?.trim() || null,
                analitic378: row.glob_378?.trim() || null,
                analitic4428: row.glob_4428?.trim() || null,
                analitic607: row.glob_607?.trim() || null,
                analitic707: row.glob_707?.trim() || null,
                vatRate: vatRate as VatRate,
              };
            }) : [];
            
            if (articleData.length > 0) {
              const articleCodeCounts = articleData.reduce((acc, a) => {
                acc[a.code] = (acc[a.code] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);

              const articleDuplicates = Object.keys(articleCodeCounts)
                .filter((code) => articleCodeCounts[code] > 1); 

              if (articleDuplicates.length) {
                throw new BadRequestException(`Duplicate cod values in articles.csv: ${articleDuplicates.join(', ')}`);
              }
            }
          
            if (managementData.length > 0) {
              const managementCodeCounts = managementData.reduce((acc, m) => {
                acc[m.code] = (acc[m.code] || 0) + 1;
                return acc;
              }, {} as Record<string, number>); 

              const managementDuplicates = Object.keys(managementCodeCounts)
                .filter((code) => managementCodeCounts[code] > 1);

              if (managementDuplicates.length) {
                throw new BadRequestException(`Duplicate cod values in management.csv: ${managementDuplicates.join(', ')}`);
              }
            }

            const user = await this.prisma.user.findUnique({
              where: { id: reqUser.id },
            });

            if (!user) throw new NotFoundException('User not found in the database!');
        
            this.logger.log('Calling ANAF service...');
            const companyData = await this.anaf.getCompanyDetails(ein.ein);
            this.logger.log('ANAF service responded');
            if (!companyData) throw new NotFoundException("Company doesn't exist");
        
            this.logger.log('Starting DB transaction...');
            const result = await this.prisma.$transaction(async (prisma) => {

              const newCompany = await prisma.clientCompany.upsert({
                where: { ein: String(companyData.date_generale.cui) },
                update: {},
                create: {
                  name: companyData.date_generale.denumire,
                  ein: String(companyData.date_generale.cui),
                },
              });
              
              const link = await prisma.accountingClients.upsert({
                where: {
                    accountingCompanyId_clientCompanyId: {
                        accountingCompanyId: user.accountingCompanyId,
                        clientCompanyId: newCompany.id,
                    }
                },
                update: {},
                create: {
                    accountingCompanyId: user.accountingCompanyId,
                    clientCompanyId: newCompany.id,
                },
            });
        
              let articleResult = { count: 0 };
              if (articleData.length > 0) {
                this.logger.log(`Creating ${articleData.length} articles...`);
                articleResult = await prisma.article.createMany({
                  data: articleData.map((data) => ({
                    ...data,
                    clientCompanyId: newCompany.id,
                    accountingClientId: link.id,
                  })),
                  skipDuplicates: true,
                });
              }
        
              let managementResult = { count: 0 };
              if (managementData.length > 0) {
                this.logger.log(`Creating ${managementData.length} management records...`);
                managementResult = await prisma.management.createMany({
                  data: managementData.map((data) => ({
                    ...data,
                    clientCompanyId: newCompany.id,
                    accountingClientId: link.id,
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
            this.logger.log('DB transaction finished');
        
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
            throw new InternalServerErrorException('Failed to create client company: ' + e.message);
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
            
            const parser = parse({
                columns: true,
                trim: true,
                skip_empty_lines: true,
                delimiter: ',',
                relax_column_count: true,
                relax_quotes: true,
                from_line: 1,
            });
            
            parser.on('readable', function(){
                let record;
                while (record = parser.read()) {
                    results.push(record);
                }
            });
            
            parser.on('error', function(err){
                this.logger.error(`Error parsing CSV: ${err.message}`);
                reject(new BadRequestException(`Failed to parse ${file.originalname}: ${err.message}`));
            });
            
            parser.on('end', function(){
                resolve(results);
            });
            
            fs.createReadStream(file.path).pipe(parser);
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

    async deleteArticle(articleId: number, reqUser: User) {
      try {
          const article = await this.prisma.article.findUnique({
              where: { id: articleId },
              include: {
                  accountingClient: {
                      include: {
                          accountingCompany: true
                      }
                  }
              }
          });
  
          if (!article) {
              throw new NotFoundException('Article not found in the database!');
          }
  
          const user = await this.prisma.user.findUnique({
              where: { id: reqUser.id },
              select: { accountingCompanyId: true }
          });
  
          if (!user) {
              throw new NotFoundException('User not found in the database');
          }
  
          if (article.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
              console.error(`[SECURITY] User ${reqUser.id} attempted to delete article ${articleId} without authorization`);
              throw new UnauthorizedException('You do not have access to delete this article!');
          }
  
          const deletedArticle = await this.prisma.article.delete({
              where: { id: articleId }
          });
  
          return deletedArticle;
  
      } catch (e) {
          if (e instanceof NotFoundException || e instanceof UnauthorizedException) {
              throw e;
          }
          console.error('Error deleting article:', e);
          throw new InternalServerErrorException('Failed to delete article from the database!');
      }
  }
    
  async deleteManagement(managementId: number, reqUser: User) { 
    try {
        const management = await this.prisma.management.findUnique({
            where: { id: managementId },
            include: {
                accountingClient: {
                    include: {
                        accountingCompany: true
                    }
                }
            }
        });

        if (!management) {
            throw new NotFoundException('Management record not found in the database!');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: reqUser.id },
            select: { accountingCompanyId: true }
        });

        if (!user) {
            throw new NotFoundException('User not found in the database');
        }

        if (management.accountingClient.accountingCompanyId !== user.accountingCompanyId) {
            console.error(`[SECURITY] User ${reqUser.id} attempted to delete management ${managementId} without authorization`);
            throw new UnauthorizedException('You do not have access to delete this management record!');
        }

        const deletedManagement = await this.prisma.management.delete({
            where: { id: managementId }
        });

        return deletedManagement;

    } catch (e) {
        if (e instanceof NotFoundException || e instanceof UnauthorizedException) {
            throw e;
        }
        console.error('Error deleting management:', e);
        throw new InternalServerErrorException('Failed to delete management from the database!');
    }
}

async saveNewManagement(dto: NewManagementDto, reqUser: User) {
  try {
      const user = await this.prisma.user.findUnique({
          where: { id: reqUser.id },
          select: { accountingCompanyId: true }
      });

      if (!user) {
          throw new NotFoundException('User not found in the database');
      }

      const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: dto.currentClientCompanyEin }
      });

      if (!clientCompany) {
          throw new NotFoundException('Client company not found in the database');
      }

      const accountingClientRelation = await this.prisma.accountingClients.findFirst({
          where: {
              accountingCompanyId: user.accountingCompanyId,
              clientCompanyId: clientCompany.id
          }
      });

      if (!accountingClientRelation) {
          throw new UnauthorizedException('You do not have access to create management records for this client!');
      }

      let type: ManagementType;
      switch (dto.type) {
          case 'GLOBAL_VALORIC':
              type = ManagementType.GLOBAL_VALORIC;
              break;
          case 'CANTITATIV_VALORIC':
          default:
              type = ManagementType.CANTITATIV_VALORIC;
              break;
      }

      let vatRate: VatRate;
      switch (dto.vatRate) {
          case 'ZERO':
              vatRate = VatRate.ZERO;
              break;
          case 'FIVE':
              vatRate = VatRate.FIVE;
              break;
          case 'NINE':
              vatRate = VatRate.NINE;
              break;
          case 'NINETEEN':
          default:
              vatRate = VatRate.NINETEEN;
              break;
      }

      const newManagement = await this.prisma.management.create({
          data: {
              accountingClientId: accountingClientRelation.id, 
              clientCompanyId: clientCompany.id,          
              code: dto.code,
              name: dto.name,
              type: type,
              manager: dto.manager,
              isSellingPrice: dto.isSellingPrice,
              vatRate: vatRate
          }
      });

      if (!newManagement) {
          throw new InternalServerErrorException('Failed to create new management, please try again later!');
      }

      return newManagement;

  } catch (e) {
      if (e instanceof NotFoundException || e instanceof UnauthorizedException) {
          throw e;
      }
      console.error('Error creating a new management:', e);
      throw new InternalServerErrorException('Failed to create management record');
  }
}

async getCompanyData(currentCompanyEin: string, reqUser: User, year: string) {
  try {
      console.log(`[COMPANY_DATA] Starting for EIN: ${currentCompanyEin}, Year: ${year}`);
      
      const clientCompany = await this.prisma.clientCompany.findUnique({
          where: { ein: currentCompanyEin }
      });

      if (!clientCompany) throw new NotFoundException('Client company not found in the database');

      const user = await this.prisma.user.findUnique({
          where: { id: reqUser.id }
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

      console.log(`[COMPANY_DATA] Found ${processedData.length} processed documents`);
      console.log(`[COMPANY_DATA] Current company EIN: ${currentCompanyEin}`);

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

      const transactionLog = [];

      processedData.forEach((docData) => {
        const extractedData = docData.extractedFields as {
            result: {
                buyer_ein: string,
                buyer: string,
                vendor_ein?: string,
                vendor: string,
                total_amount: number,
                vat_amount: number,
                document_date: string,
                document_number?: string,
                document_type?: string
            }
        };
    
        if (!extractedData || !extractedData.result || !extractedData.result.document_date) {
            console.log(`[COMPANY_DATA] Skipping document with missing or invalid data:`, {
                hasExtractedData: !!extractedData,
                hasResult: !!(extractedData && extractedData.result),
                hasDocumentDate: !!(extractedData && extractedData.result && extractedData.result.document_date)
            });
            return;
        }
    
        if (typeof extractedData.result.document_date !== 'string' || extractedData.result.document_date.trim() === '') {
            console.log(`[COMPANY_DATA] Skipping document with invalid document_date:`, extractedData.result.document_date);
            return;
        }
    
        if (isNaN(extractedData.result.total_amount) || isNaN(extractedData.result.vat_amount)) {
            console.log(`[COMPANY_DATA] Skipping document with invalid amounts:`, {
                total_amount: extractedData.result.total_amount,
                vat_amount: extractedData.result.vat_amount
            });
            return;
        }
    
        const docYear = extractedData.result.document_date.split('/')[2] ||
            extractedData.result.document_date.slice(6);
    
        if (year && year !== 'all' && docYear !== year) {
            console.log(`[YEAR_FILTER] Skipping transaction from year ${docYear} (filtering for ${year})`);
            return;
        }
    
        const docMonth = extractedData.result.document_date.split('/')[1] ||
            extractedData.result.document_date.slice(3, 5);
    
        const docMonthIndex = Number(docMonth) - 1;
        const amountWithoutVat = extractedData.result.total_amount - extractedData.result.vat_amount;
    
        const isClientBuyer = extractedData.result.buyer_ein === currentCompanyEin;
        const transactionType = isClientBuyer ? 'EXPENSE' : 'INCOME';
        
        console.log(`[COMPANY_DATA] Processing transaction:`);
        console.log(`  - Document Type: ${extractedData.result.document_type || 'Unknown'}`);
        console.log(`  - Document Number: ${extractedData.result.document_number || 'Unknown'}`);
        console.log(`  - Date: ${extractedData.result.document_date}`);
        console.log(`  - Year: ${docYear}`);
        console.log(`  - Buyer: ${extractedData.result.buyer} (EIN: ${extractedData.result.buyer_ein})`);
        console.log(`  - Vendor: ${extractedData.result.vendor} (EIN: ${extractedData.result.vendor_ein || 'Unknown'})`);
        console.log(`  - Amount (without VAT): ${amountWithoutVat}`);
        console.log(`  - Current Company EIN: ${currentCompanyEin}`);
        console.log(`  - Is Client Buyer: ${isClientBuyer}`);
        console.log(`  - Transaction Type: ${transactionType}`);
        console.log(`  ---`);
    
        transactionLog.push({
            documentType: extractedData.result.document_type,
            documentNumber: extractedData.result.document_number,
            date: extractedData.result.document_date,
            buyer: extractedData.result.buyer,
            buyerEin: extractedData.result.buyer_ein,
            vendor: extractedData.result.vendor,
            vendorEin: extractedData.result.vendor_ein,
            amount: amountWithoutVat,
            isClientBuyer,
            transactionType,
            month: docMonth,
            year: docYear
        });
    
        const shouldCountInMonthly = !year || docYear === year;
    
        if (isClientBuyer) {
            if (Number(docMonth) === Number(currentMonth) - 1) {
                expensesLastMonth += amountWithoutVat;
            } else if (Number(docMonth) === Number(currentMonth)) {
                expensesCurrentMonth += amountWithoutVat;
            }
          
            if (shouldCountInMonthly && docMonthIndex >= 0 && docMonthIndex < 12) {
                monthlyData[docMonthIndex].expenses += amountWithoutVat;
            }
        } else {
            if (Number(docMonth) === Number(currentMonth) - 1) {
                incomeLastMonth += amountWithoutVat;
            } else if (Number(docMonth) === Number(currentMonth)) {
                incomeCurrentMonth += amountWithoutVat;
            }
          
            if (shouldCountInMonthly && docMonthIndex >= 0 && docMonthIndex < 12) {
                monthlyData[docMonthIndex].income += amountWithoutVat;
            }
        }
    });

      console.log(`[COMPANY_DATA] Transaction Summary:`);
      console.log(`  - Total Transactions: ${transactionLog.length}`);
      console.log(`  - Expenses: ${transactionLog.filter(t => t.transactionType === 'EXPENSE').length}`);
      console.log(`  - Income: ${transactionLog.filter(t => t.transactionType === 'INCOME').length}`);

      return {
          incomeLastMonth,
          expensesLastMonth,
          incomeCurrentMonth,
          expensesCurrentMonth,
          graphData: {
              monthlyData
          },
          rpaProcesses: 'here',
          debug: {
              currentCompanyEin,
              transactionLog: transactionLog.slice(0, 10),
              summary: {
                  totalTransactions: transactionLog.length,
                  expenseTransactions: transactionLog.filter(t => t.transactionType === 'EXPENSE').length,
                  incomeTransactions: transactionLog.filter(t => t.transactionType === 'INCOME').length
              }
          }
      };
  } catch (e) {
      console.error('Not found company data in the database:', e);
      throw e;
  }
}

    // ==================== LEDGER ENDPOINTS ====================

    async getLedgerEntries(
        ein: string,
        user: User,
        page: number = 1,
        size: number = 50,
        startDate?: string,
        endDate?: string,
        accountCode?: string
    ) {
        const clientCompany = await this.getClientCompanyByEin(ein, user);
        const accountingClient = await this.getAccountingClient(clientCompany.id, user);
        
        const whereCondition: any = {
            accountingClientId: accountingClient.id
        };

        if (startDate && endDate) {
            whereCondition.postingDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (accountCode) {
            whereCondition.accountCode = accountCode;
        }

        const [entries, total] = await Promise.all([
            this.prisma.generalLedgerEntry.findMany({
                where: whereCondition,
                include: {
                    document: {
                        select: { id: true, name: true, type: true }
                    },
                    bankTransaction: {
                        select: { id: true, description: true, transactionDate: true }
                    },
                    reconciliation: {
                        select: { id: true, notes: true }
                    }
                },
                orderBy: { postingDate: 'desc' },
                skip: (page - 1) * size,
                take: size
            }),
            this.prisma.generalLedgerEntry.count({ where: whereCondition })
        ]);

        return {
            entries: entries.map(entry => ({
                id: entry.id,
                postingDate: entry.postingDate,
                accountCode: entry.accountCode,
                debit: Number(entry.debit),
                credit: Number(entry.credit),
                sourceType: entry.sourceType,
                sourceId: entry.sourceId,
                document: entry.document,
                bankTransaction: entry.bankTransaction,
                reconciliation: entry.reconciliation,
                createdAt: entry.createdAt
            })),
            pagination: {
                page,
                size,
                total,
                totalPages: Math.ceil(total / size)
            }
        };
    }

    async getLedgerSummary(
        ein: string,
        user: User,
        startDate: string,
        endDate: string
    ) {
        const clientCompany = await this.getClientCompanyByEin(ein, user);
        const accountingClient = await this.getAccountingClient(clientCompany.id, user);
        
        const entries = await this.prisma.generalLedgerEntry.findMany({
            where: {
                accountingClientId: accountingClient.id,
                postingDate: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            select: {
                accountCode: true,
                debit: true,
                credit: true,
                sourceType: true
            }
        });

        // Group by account code
        const accountSummary = new Map<string, { debit: number; credit: number; net: number }>();
        
        entries.forEach(entry => {
            const current = accountSummary.get(entry.accountCode) || { debit: 0, credit: 0, net: 0 };
            current.debit += Number(entry.debit);
            current.credit += Number(entry.credit);
            current.net = current.debit - current.credit;
            accountSummary.set(entry.accountCode, current);
        });

        // Group by source type
        const sourceSummary = new Map<string, number>();
        entries.forEach(entry => {
            const current = sourceSummary.get(entry.sourceType) || 0;
            sourceSummary.set(entry.sourceType, current + 1);
        });

        return {
            period: { startDate, endDate },
            totalEntries: entries.length,
            accountSummary: Array.from(accountSummary.entries()).map(([code, summary]) => ({
                accountCode: code,
                ...summary
            })),
            sourceSummary: Array.from(sourceSummary.entries()).map(([type, count]) => ({
                sourceType: type,
                count
            }))
        };
    }

    async getDashboardMetrics(ein: string, user: User) {
        const clientCompany = await this.getClientCompanyByEin(ein, user);
        const accountingClient = await this.getAccountingClient(clientCompany.id, user);
        
        return await this.financialMetricsService.getDashboardMetrics(accountingClient.id);
    }

    async getFinancialReports(
        ein: string,
        user: User,
        year: number,
        type: 'pnl' | 'balance' | 'cashflow'
    ) {
        const clientCompany = await this.getClientCompanyByEin(ein, user);
        const accountingClient = await this.getAccountingClient(clientCompany.id, user);
        
        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year, 11, 31);
        
        return await this.financialMetricsService.getHistoricalMetrics(
            accountingClient.id,
            'MONTHLY',
            startDate,
            endDate
        );
    }

    async triggerMetricsCalculation(
        ein: string,
        user: User,
        periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY'
    ) {
        const clientCompany = await this.getClientCompanyByEin(ein, user);
        const accountingClient = await this.getAccountingClient(clientCompany.id, user);
        
        return await this.financialMetricsService.triggerMetricsCalculation(
            accountingClient.id,
            periodType
        );
    }

    // Helper methods
    private async getClientCompanyByEin(ein: string, user: User) {
        const clientCompany = await this.prisma.clientCompany.findUnique({
            where: { ein }
        });

        if (!clientCompany) {
            throw new NotFoundException('Client company not found');
        }

        return clientCompany;
    }

    private async getAccountingClient(clientCompanyId: number, user: User) {
        const accountingClient = await this.prisma.accountingClients.findFirst({
            where: {
                accountingCompanyId: user.accountingCompanyId,
                clientCompanyId: clientCompanyId
            }
        });

        if (!accountingClient) {
            throw new UnauthorizedException('No access to this client company');
        }

        return accountingClient;
    }
}