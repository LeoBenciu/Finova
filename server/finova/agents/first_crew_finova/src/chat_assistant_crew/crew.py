from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Optional
import os
import sys
import traceback

def get_serper_tool():
    """Import serper tool with proper error handling"""
    try:
        from first_crew_finova.tools.serper_tool import get_serper_tool as _get_serper
        return _get_serper()
    except ImportError:
        print("Warning: Serper tool not available", file=sys.stderr)
        return None

def get_backend_tools():
    """Import backend tools with proper error handling"""
    try:
        from first_crew_finova.tools.backend_tool import get_backend_tools as _get_backend
        return _get_backend()
    except ImportError:
        print("Warning: Backend tools not available", file=sys.stderr)
        return []

def get_configured_llm():
    """Get properly configured LLM for CrewAI agents - matches the main crew configuration"""
    
    openai_api_key = os.getenv('OPENAI_API_KEY')
    model_name = os.getenv('MODEL', 'gpt-4o-mini')
    
    if not openai_api_key:
        print("ERROR: OPENAI_API_KEY environment variable not found", file=sys.stderr)
        return None
    
    try:
        llm = LLM(
            model=model_name,
            temperature=0.7,
            max_tokens=2000
        )
        
        print("Chat Assistant LLM configuration successful", file=sys.stderr)
        return llm
        
    except Exception as e:
        print(f"ERROR: Failed to configure Chat Assistant LLM: {str(e)}", file=sys.stderr)
        print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
        return None

@CrewBase
class ChatAssistantCrew:
    """
    Chat Assistant Crew for handling user queries and providing intelligent responses.
    Follows the same configuration pattern as FirstCrewFinova for consistency.
    """
    
    agents_config = 'config/chat_agents.yaml'  # Separate config for chat agents
    tasks_config = 'config/chat_tasks.yaml'    # Separate config for chat tasks
    
    def __init__(self, client_company_ein: str, chat_history: List[Dict] = None):
        self.client_company_ein = client_company_ein
        self.chat_history = chat_history or []
        self.llm = get_configured_llm()
        
        # Debug logging similar to FirstCrewFinova
        print(f"ChatAssistant: Current working directory: {os.getcwd()}", file=sys.stderr)
        print(f"ChatAssistant: Looking for agents config at: {self.agents_config}", file=sys.stderr)
        print(f"ChatAssistant: Agents config file exists: {os.path.exists(self.agents_config)}", file=sys.stderr)
    
    @agent
    def chat_agent(self) -> Agent:
        """Create the main chat agent with proper tool configuration."""
        tools = []

        # Add Serper research tool if available
        serper_tool = get_serper_tool()
        if serper_tool:
            tools.append(serper_tool)
            print("Chat agent: Serper research enabled", file=sys.stderr)
        else:
            print("Chat agent: Serper research not available", file=sys.stderr)

        # Add backend tools if available
        try:
            from first_crew_finova.tools.backend_tool import get_backend_tools as _get_backend
            backend_tools = _get_backend()
            if backend_tools:
                tools.extend(backend_tools)
                print(f"Chat agent: Backend tools enabled ({len(backend_tools)} tools)", file=sys.stderr)
            else:
                print("Chat agent: No backend tools available", file=sys.stderr)
        except Exception as e:
            print(f"Chat agent: Backend tools failed to load: {str(e)}", file=sys.stderr)

        # Log available tools for debugging
        tool_names = [getattr(t, 'name', str(t)) for t in tools]
        print(f"Chat agent initialized with tools: {tool_names}", file=sys.stderr)

        agent_config = {
            'role': "Financial Chat Assistant",
            'goal': """Provide helpful, accurate, and context-aware responses to user queries about 
                      financial data and documents. Use available tools to fetch live data when appropriate.""",
            'backstory': """You are Finly, an AI Assistant for Finova (a platform for Romanian accounting 
                           companies powered by AI), specialized in Romanian accounting and financial matters. 
                           You help users with financial data analysis, document retrieval, and accounting insights.""",
            'verbose': True,
            'allow_delegation': False,
            'tools': tools,
        }

        if self.llm:
            agent_config['llm'] = self.llm
        else:
            print("WARNING: No LLM configured for chat agent", file=sys.stderr)

        return Agent(**agent_config)
    
    @task
    def process_query_task(self) -> Task:
        """Create the task for processing user queries with explicit tool usage."""
        return Task(
            description="""
            Analyze the user's query and provide a helpful response using available tools when appropriate.

            TOOL USAGE GUIDELINES:

            1. FINANCIAL DATA REQUESTS:
               - If user asks about company financials, USE company_financial_info tool
               - Available topics: 'summary', 'accounts', 'outstanding', 'balance', 'audit'
               - Example: "Show me financial summary" → use tool with topic='summary'

            2. REAL-TIME INFORMATION:
               - For current date/time questions, ALWAYS use current_date tool
               - For accounting research, use serper_accounting_research tool

            3. DOCUMENT REQUESTS:
               - If user asks for specific documents, USE search_documents tool

            4. EMAIL REQUESTS:
               - If user wants to send emails, USE send_email tool

            IMPORTANT: Always use tools when relevant data is needed. Don't assume you know current dates or financial data.

            Context:
            - Client Company EIN: {client_company_ein}
            - User Query: {user_query}
            - Chat History: {chat_history}
            """,
            agent=self.chat_agent(),
            expected_output="A helpful response using appropriate tools when needed. Include actual data from tools.",
            tools=self.chat_agent().tools
        )
    
    @crew
    def crew(self) -> Crew:
        """Create the crew for chat processing with proper tool configuration."""
        chat_agent_instance = self.chat_agent()

        crew_config = {
            'agents': [chat_agent_instance],
            'tasks': [self.process_query_task()],
            'verbose': True,
            'process': 'sequential',
        }

        if self.llm:
            crew_config['manager_llm'] = self.llm

        return Crew(**crew_config)

    def check_tools_availability(self):
        """Debug method to check what tools are available"""
        try:
            from first_crew_finova.tools.backend_tool import get_backend_tools
            backend_tools = get_backend_tools()
            print(f"Backend tools available: {[t.name for t in backend_tools] if backend_tools else 'None'}")
        
            serper_tool = get_serper_tool()
            print(f"Serper tool available: {serper_tool.name if serper_tool else 'None'}")
        
        except Exception as e:
            print(f"Tool check error: {e}")
    
    def process_message(self, user_query: str) -> str:
        """Process a user message and return a response."""
        try:
            # Prepare chat history string
            chat_history_str = '\n'.join([
                f"{msg['role']}: {msg['content']}" 
                for msg in self.chat_history[-10:]  # Keep last 10 messages for context
            ])
            
            # Create crew and process
            chat_crew = self.crew()
            
            inputs = {
                'client_company_ein': self.client_company_ein,
                'user_query': user_query,
                'chat_history': chat_history_str
            }
            
            result = chat_crew.kickoff(inputs=inputs)
            
            # Extract result based on CrewAI version
            if hasattr(result, 'tasks_output') and result.tasks_output:
                response = result.tasks_output[0].raw
            elif hasattr(result, 'raw'):
                response = result.raw
            else:
                response = str(result)
            
            # Update chat history
            self.chat_history.append({"role": "user", "content": user_query})
            self.chat_history.append({"role": "assistant", "content": response})
            
            # Limit chat history to prevent memory issues
            if len(self.chat_history) > 20:
                self.chat_history = self.chat_history[-20:]
            
            return response
            
        except Exception as e:
            error_msg = f"I encountered an error processing your request: {str(e)}"
            print(f"ChatAssistant error: {str(e)}", file=sys.stderr)
            print(f"Traceback:\n{traceback.format_exc()}", file=sys.stderr)
            return error_msg