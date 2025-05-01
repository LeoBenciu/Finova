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

// Sample data for the year 2025 – one data point per month.
const sampleData2025 = [
  { month: "Jan", income: 5000, expenses: 3200 },
  { month: "Feb", income: 6000, expenses: 3500 },
  { month: "Mar", income: 5500, expenses: 3000 },
  { month: "Apr", income: 7000, expenses: 4000 },
  { month: "May", income: 6500, expenses: 3800 },
  { month: "Jun", income: 7200, expenses: 4100 },
  { month: "Jul", income: 6800, expenses: 3900 },
  { month: "Aug", income: 7500, expenses: 4200 },
  { month: "Sep", income: 7000, expenses: 4000 },
  { month: "Oct", income: 7300, expenses: 4100 },
  { month: "Nov", income: 7100, expenses: 4050 },
  { month: "Dec", income: 7600, expenses: 4300 },
]

// For years other than 2025, we simply generate zero values.
const generateEmptyData = (year: number) =>
  Array.from({ length: 12 }, (_, i) => {
    const monthLabel = new Date(year, i, 1).toLocaleString("en-US", {
      month: "short",
    })
    return { month: monthLabel, income: 0, expenses: 0 }
  })

// A simple lookup for sample data by year.
const sampleDataByYear: Record<string, { month: string; income: number; expenses: number }[]> = {
  "2020": generateEmptyData(2020),
  "2021": generateEmptyData(2021),
  "2022": generateEmptyData(2022),
  "2023": generateEmptyData(2023),
  "2025": sampleData2025,
}

export function ChartDashboard() {
  const [year, setYear] = React.useState("2025");
  const language = useSelector((state:{user:{language:string}})=>state.user.language);

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
  }, [language])

  // Get the appropriate data based on the selected year.
  const chartData = React.useMemo(() => {
    return sampleDataByYear[year] || generateEmptyData(parseInt(year, 10))
  }, [year])

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
            <SelectItem value="2020" className="rounded-lg cursor-pointer text-[var(--text1)]">
              2020
            </SelectItem>
            <SelectItem value="2021" className="rounded-lg cursor-pointer text-[var(--text1)]">
              2021
            </SelectItem>
            <SelectItem value="2022" className="rounded-lg cursor-pointer text-[var(--text1)]">
              2022
            </SelectItem>
            <SelectItem value="2023" className="rounded-lg cursor-pointer text-[var(--text1)]">
              2023
            </SelectItem>
            <SelectItem value="2025" className="rounded-lg cursor-pointer text-[var(--text1)]">
              2025
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-4 pt-10 flex-1">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full text-[var(--text1)]"
        >
          <AreaChart data={chartData} margin={{ left: 10, right: 10 }}>
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
              ticks={chartData.map(d => d.month)}
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
