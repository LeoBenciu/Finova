import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface FinancialMetricsData {
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netCashFlow: number;
  grossProfitMargin: number;
  netProfitMargin: number;
  currentRatio: number;
}

export interface AccountCategoryData {
  accountType: string;
  categoryName: string;
  totalDebit: number;
  totalCredit: number;
  netAmount: number;
}

@Injectable()
export class FinancialMetricsService {
  private readonly logger = new Logger(FinancialMetricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate and store financial metrics for a specific period
   */
  async calculateMetrics(
    accountingClientId: number,
    periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    periodStart: Date,
    periodEnd: Date
  ): Promise<FinancialMetricsData> {
    
    this.logger.log(`Calculating ${periodType} metrics for client ${accountingClientId} from ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // Get all ledger entries for the period
    const ledgerEntries = await this.prisma.generalLedgerEntry.findMany({
      where: {
        accountingClientId,
        postingDate: { gte: periodStart, lte: periodEnd }
      }
    });

    // Calculate metrics
    const metrics = this.calculateMetricsFromEntries(ledgerEntries);
    
    // Store the metrics
    await this.prisma.financialMetrics.upsert({
      where: {
        accountingClientId_periodType_periodStart: {
          accountingClientId,
          periodType,
          periodStart
        }
      },
      update: {
        periodEnd,
        totalRevenue: new Prisma.Decimal(metrics.totalRevenue),
        totalExpenses: new Prisma.Decimal(metrics.totalExpenses),
        grossProfit: new Prisma.Decimal(metrics.grossProfit),
        netIncome: new Prisma.Decimal(metrics.netIncome),
        totalAssets: new Prisma.Decimal(metrics.totalAssets),
        totalLiabilities: new Prisma.Decimal(metrics.totalLiabilities),
        totalEquity: new Prisma.Decimal(metrics.totalEquity),
        operatingCashFlow: new Prisma.Decimal(metrics.operatingCashFlow),
        investingCashFlow: new Prisma.Decimal(metrics.investingCashFlow),
        financingCashFlow: new Prisma.Decimal(metrics.financingCashFlow),
        netCashFlow: new Prisma.Decimal(metrics.netCashFlow),
        grossProfitMargin: new Prisma.Decimal(metrics.grossProfitMargin),
        netProfitMargin: new Prisma.Decimal(metrics.netProfitMargin),
        currentRatio: new Prisma.Decimal(metrics.currentRatio),
        updatedAt: new Date()
      },
      create: {
        accountingClientId,
        periodType,
        periodStart,
        periodEnd,
        totalRevenue: new Prisma.Decimal(metrics.totalRevenue),
        totalExpenses: new Prisma.Decimal(metrics.totalExpenses),
        grossProfit: new Prisma.Decimal(metrics.grossProfit),
        netIncome: new Prisma.Decimal(metrics.netIncome),
        totalAssets: new Prisma.Decimal(metrics.totalAssets),
        totalLiabilities: new Prisma.Decimal(metrics.totalLiabilities),
        totalEquity: new Prisma.Decimal(metrics.totalEquity),
        operatingCashFlow: new Prisma.Decimal(metrics.operatingCashFlow),
        investingCashFlow: new Prisma.Decimal(metrics.investingCashFlow),
        financingCashFlow: new Prisma.Decimal(metrics.financingCashFlow),
        netCashFlow: new Prisma.Decimal(metrics.netCashFlow),
        grossProfitMargin: new Prisma.Decimal(metrics.grossProfitMargin),
        netProfitMargin: new Prisma.Decimal(metrics.netProfitMargin),
        currentRatio: new Prisma.Decimal(metrics.currentRatio)
      }
    });

    // Calculate and store account category metrics
    await this.calculateAccountCategoryMetrics(accountingClientId, periodType, periodStart, periodEnd, ledgerEntries);

    this.logger.log(`Successfully calculated and stored ${periodType} metrics for client ${accountingClientId}`);

    return metrics;
  }

  /**
   * Calculate metrics from ledger entries
   */
  private calculateMetricsFromEntries(entries: any[]): FinancialMetricsData {
    // Romanian Chart of Accounts mapping
    const revenueAccounts = ['7', '8']; // 7xx = Revenue, 8xx = Other Income
    const expenseAccounts = ['6']; // 6xx = Expenses
    const assetAccounts = ['1', '2', '3', '5']; // 1xx = Fixed Assets, 2xx = Current Assets, 3xx = Inventory, 5xx = Cash
    const liabilityAccounts = ['4']; // 4xx = Liabilities
    const equityAccounts = ['1']; // 1xx = Equity (part of assets in Romanian system)

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let operatingCashFlow = 0;
    let investingCashFlow = 0;
    let financingCashFlow = 0;

    entries.forEach(entry => {
      const accountCode = entry.accountCode;
      const debit = Number(entry.debit);
      const credit = Number(entry.credit);
      const netAmount = debit - credit;

      // Revenue calculation (credit side of revenue accounts)
      if (revenueAccounts.some(prefix => accountCode.startsWith(prefix))) {
        totalRevenue += credit;
        operatingCashFlow += credit; // Revenue typically increases operating cash flow
      }

      // Expense calculation (debit side of expense accounts)
      if (expenseAccounts.some(prefix => accountCode.startsWith(prefix))) {
        totalExpenses += debit;
        operatingCashFlow -= debit; // Expenses typically decrease operating cash flow
      }

      // Asset calculation
      if (assetAccounts.some(prefix => accountCode.startsWith(prefix))) {
        totalAssets += netAmount;
        
        // Cash flow categorization
        if (accountCode.startsWith('5')) { // Cash accounts
          operatingCashFlow += netAmount;
        } else if (accountCode.startsWith('2') || accountCode.startsWith('3')) { // Current assets, inventory
          operatingCashFlow += netAmount;
        } else { // Fixed assets
          investingCashFlow += netAmount;
        }
      }

      // Liability calculation
      if (liabilityAccounts.some(prefix => accountCode.startsWith(prefix))) {
        totalLiabilities += Math.abs(netAmount);
        
        // Cash flow categorization
        if (accountCode.startsWith('4')) { // Liabilities
          financingCashFlow += Math.abs(netAmount);
        }
      }

      // Equity calculation (simplified - in Romanian system, equity is part of assets)
      if (accountCode.startsWith('1') && !accountCode.startsWith('2') && !accountCode.startsWith('3')) {
        totalEquity += netAmount;
        financingCashFlow += netAmount;
      }
    });

    const grossProfit = totalRevenue - totalExpenses;
    const netIncome = grossProfit; // Simplified - in real system you'd have more complex calculations
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    // Calculate ratios
    const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
    
    // Current ratio = Current Assets / Current Liabilities
    // For simplicity, we'll use a basic calculation
    const currentRatio = totalLiabilities > 0 ? totalAssets / totalLiabilities : 0;

    return {
      totalRevenue,
      totalExpenses,
      grossProfit,
      netIncome,
      totalAssets,
      totalLiabilities,
      totalEquity,
      operatingCashFlow,
      investingCashFlow,
      financingCashFlow,
      netCashFlow,
      grossProfitMargin,
      netProfitMargin,
      currentRatio
    };
  }

  /**
   * Calculate account category metrics
   */
  private async calculateAccountCategoryMetrics(
    accountingClientId: number,
    periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    periodStart: Date,
    periodEnd: Date,
    entries: any[]
  ): Promise<void> {
    
    // Group entries by account type
    const categoryMap = new Map<string, AccountCategoryData>();

    entries.forEach(entry => {
      const accountCode = entry.accountCode;
      const accountType = this.getAccountType(accountCode);
      const categoryName = this.getCategoryName(accountCode);
      const key = `${accountType}-${categoryName}`;

      const current = categoryMap.get(key) || {
        accountType,
        categoryName,
        totalDebit: 0,
        totalCredit: 0,
        netAmount: 0
      };

      current.totalDebit += Number(entry.debit);
      current.totalCredit += Number(entry.credit);
      current.netAmount = current.totalDebit - current.totalCredit;

      categoryMap.set(key, current);
    });

    // Store category metrics
    for (const [key, data] of categoryMap) {
      await this.prisma.accountCategoryMetrics.upsert({
        where: {
          accountingClientId_periodType_periodStart_accountType_categoryName: {
            accountingClientId,
            periodType,
            periodStart,
            accountType: data.accountType as any,
            categoryName: data.categoryName
          }
        },
        update: {
          periodEnd,
          totalDebit: new Prisma.Decimal(data.totalDebit),
          totalCredit: new Prisma.Decimal(data.totalCredit),
          netAmount: new Prisma.Decimal(data.netAmount)
        },
        create: {
          accountingClientId,
          periodType,
          periodStart,
          periodEnd,
          accountType: data.accountType as any,
          categoryName: data.categoryName,
          totalDebit: new Prisma.Decimal(data.totalDebit),
          totalCredit: new Prisma.Decimal(data.totalCredit),
          netAmount: new Prisma.Decimal(data.netAmount)
        }
      });
    }
  }

  /**
   * Get account type from account code
   */
  private getAccountType(accountCode: string): string {
    const firstDigit = accountCode.charAt(0);
    
    switch (firstDigit) {
      case '1': return 'ASSETS';
      case '2': return 'ASSETS';
      case '3': return 'ASSETS';
      case '4': return 'LIABILITIES';
      case '5': return 'ASSETS';
      case '6': return 'EXPENSE';
      case '7': return 'INCOME';
      case '8': return 'INCOME';
      default: return 'ASSETS';
    }
  }

  /**
   * Get category name from account code
   */
  private getCategoryName(accountCode: string): string {
    const firstDigit = accountCode.charAt(0);
    
    switch (firstDigit) {
      case '1': return 'Fixed Assets';
      case '2': return 'Current Assets';
      case '3': return 'Inventory';
      case '4': return 'Liabilities';
      case '5': return 'Cash & Bank';
      case '6': return 'Operating Expenses';
      case '7': return 'Revenue';
      case '8': return 'Other Income';
      default: return 'Other';
    }
  }

  /**
   * Get metrics for dashboard
   */
  async getDashboardMetrics(accountingClientId: number): Promise<FinancialMetricsData | null> {
    const currentMonth = new Date();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const metrics = await this.prisma.financialMetrics.findFirst({
      where: {
        accountingClientId,
        periodType: 'MONTHLY',
        periodStart: monthStart
      }
    });

    if (!metrics) {
      // Calculate metrics if they don't exist
      return await this.calculateMetrics(accountingClientId, 'MONTHLY', monthStart, monthEnd);
    }

    return {
      totalRevenue: Number(metrics.totalRevenue),
      totalExpenses: Number(metrics.totalExpenses),
      grossProfit: Number(metrics.grossProfit),
      netIncome: Number(metrics.netIncome),
      totalAssets: Number(metrics.totalAssets),
      totalLiabilities: Number(metrics.totalLiabilities),
      totalEquity: Number(metrics.totalEquity),
      operatingCashFlow: Number(metrics.operatingCashFlow),
      investingCashFlow: Number(metrics.investingCashFlow),
      financingCashFlow: Number(metrics.financingCashFlow),
      netCashFlow: Number(metrics.netCashFlow),
      grossProfitMargin: Number(metrics.grossProfitMargin),
      netProfitMargin: Number(metrics.netProfitMargin),
      currentRatio: Number(metrics.currentRatio)
    };
  }

  /**
   * Get historical metrics for reports
   */
  async getHistoricalMetrics(
    accountingClientId: number,
    periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    startDate: Date,
    endDate: Date
  ): Promise<FinancialMetricsData[]> {
    
    const metrics = await this.prisma.financialMetrics.findMany({
      where: {
        accountingClientId,
        periodType,
        periodStart: { gte: startDate, lte: endDate }
      },
      orderBy: { periodStart: 'asc' }
    });

    return metrics.map(metric => ({
      totalRevenue: Number(metric.totalRevenue),
      totalExpenses: Number(metric.totalExpenses),
      grossProfit: Number(metric.grossProfit),
      netIncome: Number(metric.netIncome),
      totalAssets: Number(metric.totalAssets),
      totalLiabilities: Number(metric.totalLiabilities),
      totalEquity: Number(metric.totalEquity),
      operatingCashFlow: Number(metric.operatingCashFlow),
      investingCashFlow: Number(metric.investingCashFlow),
      financingCashFlow: Number(metric.financingCashFlow),
      netCashFlow: Number(metric.netCashFlow),
      grossProfitMargin: Number(metric.grossProfitMargin),
      netProfitMargin: Number(metric.netProfitMargin),
      currentRatio: Number(metric.currentRatio)
    }));
  }

  /**
   * Get account category breakdown
   */
  async getAccountCategoryBreakdown(
    accountingClientId: number,
    periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    startDate: Date,
    endDate: Date
  ): Promise<AccountCategoryData[]> {
    
    const categories = await this.prisma.accountCategoryMetrics.findMany({
      where: {
        accountingClientId,
        periodType,
        periodStart: { gte: startDate, lte: endDate }
      },
      orderBy: [
        { accountType: 'asc' },
        { categoryName: 'asc' }
      ]
    });

    return categories.map(category => ({
      accountType: category.accountType,
      categoryName: category.categoryName,
      totalDebit: Number(category.totalDebit),
      totalCredit: Number(category.totalCredit),
      netAmount: Number(category.netAmount)
    }));
  }

  /**
   * Trigger metrics calculation for a specific period
   */
  async triggerMetricsCalculation(
    accountingClientId: number,
    periodType: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' = 'MONTHLY'
  ): Promise<FinancialMetricsData> {
    
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (periodType) {
      case 'DAILY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'MONTHLY':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'QUARTERLY':
        const quarter = Math.floor(now.getMonth() / 3);
        periodStart = new Date(now.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'YEARLY':
        periodStart = new Date(now.getFullYear(), 0, 1);
        periodEnd = new Date(now.getFullYear(), 11, 31);
        break;
    }

    return await this.calculateMetrics(accountingClientId, periodType, periodStart, periodEnd);
  }
}
