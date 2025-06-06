"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSelector } from "react-redux"

export function ChartDashboard({ setDashboardYear, chartData }: { setDashboardYear: (year: string) => void, chartData: any }) {
  const currentYear = new Date().getFullYear();
  const availableYears = React.useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());
  }, [currentYear]);

  const [year, setYear] = React.useState('');
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

  interface MonthlyDataItem {
    monthName: string;
    income: number;
    expenses: number;
  }

  const formattedChartData = React.useMemo(() => {
    if (!chartData || !chartData.graphData || !chartData.graphData.monthlyData) {
      return [];
    }
    
    return chartData.graphData.monthlyData.map((item: MonthlyDataItem) => ({
      month: item.monthName,
      income: item.income,
      expenses: item.expenses
    }));
  }, [chartData]);

  React.useEffect(() => {
    setDashboardYear(year);
  }, [year, setDashboardYear]);

  const chartConfig = React.useMemo(() => {
    return {
      income: {
        label: language === 'ro' ? 'Venituri' : 'Income',
        color: "var(--primary)",
      },
      expenses: {
        label: language === 'ro' ? 'Cheltuieli' : "Expenses",
        color: "#ef4444",
      },
    } satisfies ChartConfig
  }, [language]);

  return (
    <Card className="min-w-full min-h-full max-w-full max-h-full border-none flex flex-col">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle className="text-[var(--text1)]">{language==='ro'?'Venituri & Cheltuieli':'Income & Expenses'} ({year})</CardTitle>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger
            className="w-[160px] rounded-lg sm:ml-auto border-transparent outline-transparent focus:outline-transparent focus:border-transparent focus:ring-0
            text-[var(--text1)]"
            aria-label="Select a year"
          >
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent className="rounded-xl bg-[var(--background)] border-0">
            {availableYears.map((yearOption) => (
              <SelectItem 
                key={yearOption} 
                value={yearOption} 
                className="rounded-lg cursor-pointer text-[var(--text1)]"
              >
                {yearOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-4 pt-10 flex-1">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full text-[var(--text1)]"
        >
          <AreaChart 
            data={formattedChartData} 
            margin={{ left: 10, right: 10 }}
          >
            <defs>
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-income)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-income)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-expenses)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-expenses)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke='var(--text1)'/>
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={0}
              color="text-[var(--primaryText)]"
              interval={0}
              tick={{ fill: "var(--text1)" }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => value}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="expenses"
              type="natural"
              fill="url(#fillExpenses)"
              stroke="var(--color-expenses)"
              stackId="a"
            />
            <Area
              dataKey="income"
              type="natural"
              fill="url(#fillIncome)"
              stroke="var(--color-income)"
              stackId="a"
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}