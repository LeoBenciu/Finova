from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Optional
import os
import sys
import traceback
import json
from datetime import datetime

def get_serper_tool():
    """Import serper tool with proper error handling"""
    try:
        from first_crew_finova.tools.serper_tool import get_serper_tool as _get_serper
        return _get_serper()
    except ImportError as e:
        return f"Serper tool ImportError: {str(e)}"
    except Exception as e:
        return f"Serper tool Error: {str(e)}"

def get_backend_tools():
    """Import backend tools with proper error handling"""
    try:
        from first_crew_finova.tools.backend_tool import get_backend_tools as _get_backend
        return _get_backend()
    except ImportError as e:
        return f"Backend tools ImportError: {str(e)}"
    except Exception as e:
        return f"Backend tools Error: {str(e)}"

def get_configured_llm():
    """Get properly configured LLM for CrewAI agents - matches the main crew configuration"""
    
    openai_api_key = os.getenv('OPENAI_API_KEY')
    model_name = os.getenv('MODEL', 'gpt-4o-mini')
    
    if not openai_api_key:
        return "ERROR: OPENAI_API_KEY environment variable not found"
    
    try:
        llm = LLM(
            model=model_name,
            temperature=0.7,
            max_tokens=2000
        )
        return llm
        
    except Exception as e:
        return f"ERROR: Failed to configure LLM: {str(e)}"

@CrewBase
class ChatAssistantCrew:
    """
    Chat Assistant Crew for handling user queries and providing intelligent responses.
    """
    
    agents_config = None  # Disable YAML config to avoid conflicts
    tasks_config = None   # Disable YAML config to avoid conflicts
    
    def __init__(self, client_company_ein: str, chat_history: List[Dict] = None):
        self.client_company_ein = client_company_ein
        self.chat_history = chat_history or []
        self.llm = get_configured_llm()
        self.debug_info = []  # Store debug information
        
        # Collect debug info
        self._collect_debug_info()
    
    def _collect_debug_info(self):
        """Collect all debug information"""
        self.debug_info.append(f"Initialized at: {datetime.now().isoformat()}")
        self.debug_info.append(f"Working directory: {os.getcwd()}")
        self.debug_info.append(f"Python version: {sys.version}")
        # Basic env presence diagnostics (no secrets leaked)
        try:
            api_url = os.getenv('BACKEND_API_URL') or os.getenv('BANK_BACKEND_URL') or ''
            jwt_present = bool(os.getenv('BACKEND_JWT') or os.getenv('BANK_API_TOKEN'))
            self.debug_info.append(f"Env BACKEND_API_URL/BANK_BACKEND_URL: {'set' if api_url else 'missing'}")
            self.debug_info.append(f"Env BACKEND_JWT/BANK_API_TOKEN: {'set' if jwt_present else 'missing'}")
            if not api_url or not jwt_present:
                # Emit a warning to stderr to surface in server logs at warn level
                sys.stderr.write(
                    f"[SUGGEST] Backend tool prerequisites -> API_URL={'set' if api_url else 'missing'}, JWT={'set' if jwt_present else 'missing'}\n"
                )
        except Exception:
            pass
        
        # Check LLM
        if isinstance(self.llm, str):
            self.debug_info.append(f"LLM Error: {self.llm}")
        else:
            self.debug_info.append("LLM configured successfully")
            
        # Check tools
        serper_tool = get_serper_tool()
        if isinstance(serper_tool, str):
            self.debug_info.append(f"Serper Tool: {serper_tool}")
        else:
            self.debug_info.append("Serper Tool available")
            
        backend_tools = get_backend_tools()
        if isinstance(backend_tools, str):
            self.debug_info.append(f"Backend Tools: {backend_tools}")
        else:
            self.debug_info.append(f"Backend Tools: {len(backend_tools)} tools available")
    
    @agent
    def chat_agent(self) -> Agent:
        """Create the main chat agent with proper tool configuration."""
        tools = []
        tool_errors = []

        # Add Serper research tool if available
        serper_tool = get_serper_tool()
        if not isinstance(serper_tool, str):
            tools.append(serper_tool)
            self.debug_info.append("Serper tool added to agent")
        else:
            tool_errors.append(f"Serper: {serper_tool}")

        # Add backend tools if available
        backend_tools = get_backend_tools()
        if not isinstance(backend_tools, str):
            if isinstance(backend_tools, list) and len(backend_tools) == 0:
                # Explicit diagnostic when list is empty (env likely missing)
                self.debug_info.append(
                    "Backend Tools: unavailable (0 tools). Check BACKEND_API_URL/BANK_BACKEND_URL and BACKEND_JWT/BANK_API_TOKEN"
                )
                try:
                    api_url = os.getenv('BACKEND_API_URL') or os.getenv('BANK_BACKEND_URL') or ''
                    jwt_present = bool(os.getenv('BACKEND_JWT') or os.getenv('BANK_API_TOKEN'))
                    sys.stderr.write(
                        f"[SUGGEST] Backend tools empty -> API_URL={'set' if api_url else 'missing'}, JWT={'set' if jwt_present else 'missing'}\n"
                    )
                except Exception:
                    pass
            else:
                tools.extend(backend_tools)
                self.debug_info.append(f"Added {len(backend_tools)} backend tools to agent")
        else:
            tool_errors.append(f"Backend: {backend_tools}")
            
        # Add tool errors to debug info
        if tool_errors:
            self.debug_info.append(f"Tool errors: {', '.join(tool_errors)}")

        # Log available tools for debugging
        tool_names = []
        for tool in tools:
            if hasattr(tool, 'name'):
                tool_names.append(tool.name)
            else:
                tool_names.append(str(type(tool).__name__))
                
        self.debug_info.append(f"Final tools: {', '.join(tool_names)}")

        agent_config = {
            'role': "Financial Chat Assistant",
            'goal': """Provide helpful, accurate, and context-aware responses to user queries about 
                      financial data and documents. USE TOOLS WHENEVER POSSIBLE to fetch real data.""",
            'backstory': """You are Finly, an AI Assistant for Finova. You MUST use available tools
                           to get real-time data instead of making assumptions.""",
            'verbose': True,
            'allow_delegation': False,
            'tools': tools,
        }

        if not isinstance(self.llm, str):
            agent_config['llm'] = self.llm
        else:
            self.debug_info.append("WARNING: No valid LLM for agent")
            
        return Agent(**agent_config)
    
    @task
    def process_query_task(self) -> Task:
        """Create the task for processing user queries with explicit tool usage."""
        return Task(
            description="""
            ANALYZE THE USER QUERY AND USE TOOLS TO GET REAL DATA.
            
            MANDATORY TOOL USAGE RULES:
            1. ALWAYS use current_date tool when asked about date/time
            2. ALWAYS use company_financial_info for company data requests
            3. ALWAYS use search_documents for document requests
            4. ALWAYS use serper_accounting_research for accounting questions
            
            DO NOT make assumptions about current date or company data.
            USE TOOLS to get accurate information.
            
            Context:
            - Client Company EIN: {client_company_ein}
            - User Query: {user_query}
            - Chat History: {chat_history}
            """,
            agent=self.chat_agent(),
            expected_output="A response based on REAL DATA from tools, not assumptions.",
            tools=self.chat_agent().tools
        )
    
    @crew
    def crew(self) -> Crew:
        """Create the crew for chat processing."""
        chat_agent_instance = self.chat_agent()

        crew_config = {
            'agents': [chat_agent_instance],
            'tasks': [self.process_query_task()],
            'verbose': True,
            'process': 'sequential',
        }

        if not isinstance(self.llm, str):
            crew_config['manager_llm'] = self.llm

        return Crew(**crew_config)
    
    def process_message(self, user_query: str) -> str:
        """Process a user message and return a response with debug info."""
        try:
            # Prepare chat history string
            chat_history_str = '\n'.join([
                f"{msg['role']}: {msg['content']}" 
                for msg in self.chat_history[-10:]
            ])
            
            # Create crew and process
            chat_crew = self.crew()
            
            inputs = {
                'client_company_ein': self.client_company_ein,
                'user_query': user_query,
                'chat_history': chat_history_str
            }
            
            # Add execution to debug info
            self.debug_info.append(f"Processing query: {user_query}")
            
            result = chat_crew.kickoff(inputs=inputs)
            
            # Extract result
            if hasattr(result, 'tasks_output') and result.tasks_output:
                response = result.tasks_output[0].raw
            elif hasattr(result, 'raw'):
                response = result.raw
            else:
                response = str(result)
            
            # Update chat history
            self.chat_history.append({"role": "user", "content": user_query})
            self.chat_history.append({"role": "assistant", "content": response})
            
            # Limit chat history
            if len(self.chat_history) > 20:
                self.chat_history = self.chat_history[-20:]
            
            # Add debug info to response for now
            debug_str = "\n\nDEBUG INFO:\n" + "\n".join(self.debug_info)
            # Also emit condensed debug summary to stderr so it appears in server logs
            try:
                summary_lines = [
                    l for l in self.debug_info
                    if l.startswith('Env ') or l.startswith('LLM ') or l.startswith('Backend Tools') or l.startswith('Tool errors') or l.startswith('Final tools')
                ]
                if summary_lines:
                    sys.stderr.write("[SUGGEST] Summary:\n" + "\n".join(summary_lines) + "\n")
            except Exception:
                pass
            return response + debug_str
            
        except Exception as e:
            error_msg = f"I encountered an error: {str(e)}"
            self.debug_info.append(f"Error: {str(e)}")
            self.debug_info.append(f"Traceback: {traceback.format_exc()}")
            
            debug_str = "\n\nDEBUG INFO:\n" + "\n".join(self.debug_info)
            return error_msg + debug_str