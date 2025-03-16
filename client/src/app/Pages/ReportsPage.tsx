import { useSelector } from "react-redux"
import InitialClientCompanyModalSelect from "../Components/InitialClientCompanyModalSelect"

type clientCompanyName = {
  clientCompany:{
    current:{
      name:string,
      ein:string
    }
  }
}

const ReportsPage = () => {
  const clientCompanyName = useSelector((state:clientCompanyName)=>state.clientCompany.current.name)

  return (
    <div>
      
      {clientCompanyName===''&&(<InitialClientCompanyModalSelect/>)}
    </div>
  )
}

export default ReportsPage
