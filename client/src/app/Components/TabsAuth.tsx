import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

export function TabsAuth({content1, content2, isLogin, setIsLogin}: {content1: React.ReactNode, content2:React.ReactNode, isLogin:boolean,
  setIsLogin: (value:boolean)=>void
}) {
  return (
    <Tabs defaultValue={isLogin ? "Login" : "Signup"}
    onValueChange={(val) => setIsLogin(val === "Login")}
     className="max-w-full flex flex-col justify-center items-center">
    <TabsList className="bg-transparent max-w-max mb-5">
      <TabsTrigger value="Login" className={`border-none rounded-r-none rounded-l-xl py-3 px-10 
      bg-[var(--text4)] text-[var(--primaryText)] ${isLogin?'bg-[var(--primary)]': ''}`}>Login</TabsTrigger>
      <TabsTrigger value="Signup" className={`border-none rounded-l-none rounded-r-xl py-3 px-10
       bg-[var(--text4)] hover:bg-[var(--primaryText) ${!isLogin?'bg-[var(--primary)]':''}`}>Signup</TabsTrigger>
    </TabsList>
    <TabsContent value="Login">{content1}</TabsContent>
    <TabsContent value="Signup">{content2}</TabsContent>
  </Tabs>  
  )
}
