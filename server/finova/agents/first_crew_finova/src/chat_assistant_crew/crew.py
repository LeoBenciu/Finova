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
    """Get properly configured LLM for CrewAI agents"""
    
    openai_api_key = os.getenv('OPENAI_API_KEY')
    model_name = os.getenv('MODEL', 'gpt-4o-mini')
    
    if not openai_api_key:
        return "ERROR: OPENAI_API_KEY environment variable not found"
    
    try:
        llm = LLM(
            model=model_name,
            temperature=0.1,  # Lower temperature for more consistent tool usage
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
        self.debug_info = []
        self.available_tools = []
        
        # Collect debug info and initialize tools
        self._collect_debug_info()
        self._initialize_tools()
    
    def _initialize_tools(self):
        """Initialize and validate all available tools"""
        self.available_tools = []
        tool_errors = []

        # Add Serper research tool if available
        serper_tool = get_serper_tool()
        if not isinstance(serper_tool, str):
            self.available_tools.append(serper_tool)
            self.debug_info.append(f"✓ Serper tool added: {getattr(serper_tool, 'name', 'unnamed')}")
        else:
            tool_errors.append(f"Serper: {serper_tool}")

        # Add backend tools if available
        backend_tools = get_backend_tools()
        if not isinstance(backend_tools, str):
            if isinstance(backend_tools, list) and len(backend_tools) > 0:
                self.available_tools.extend(backend_tools)
                tool_names = [getattr(tool, 'name', 'unnamed') for tool in backend_tools]
                self.debug_info.append(f"✓ Added {len(backend_tools)} backend tools: {', '.join(tool_names)}")
            else:
                self.debug_info.append("⚠ Backend tools available but empty list")
        else:
            tool_errors.append(f"Backend: {backend_tools}")
            
        # Log any tool errors
        if tool_errors:
            self.debug_info.append(f"✗ Tool errors: {', '.join(tool_errors)}")

        # Final tool summary
        if self.available_tools:
            tool_names = [getattr(tool, 'name', str(type(tool).__name__)) for tool in self.available_tools]
            self.debug_info.append(f"📋 Final available tools: {', '.join(tool_names)}")
        else:
            self.debug_info.append("⚠ No tools available - agent will work in text-only mode")
    
    def _collect_debug_info(self):
        """Collect all debug information"""
        self.debug_info.append(f"🕐 Initialized at: {datetime.now().isoformat()}")
        self.debug_info.append(f"📁 Working directory: {os.getcwd()}")
        
        # Check environment variables
        try:
            api_url = os.getenv('BACKEND_API_URL') or os.getenv('BANK_BACKEND_URL') or ''
            jwt_present = bool(os.getenv('BACKEND_JWT') or os.getenv('BANK_API_TOKEN'))
            openai_key_present = bool(os.getenv('OPENAI_API_KEY'))
            
            self.debug_info.append(f"🔑 OPENAI_API_KEY: {'✓' if openai_key_present else '✗ missing'}")
            self.debug_info.append(f"🌐 Backend API URL: {'✓' if api_url else '✗ missing'}")
            self.debug_info.append(f"🔐 Backend JWT: {'✓' if jwt_present else '✗ missing'}")
            
        except Exception as e:
            self.debug_info.append(f"⚠ Environment check failed: {e}")
        
        # Check LLM
        if isinstance(self.llm, str):
            self.debug_info.append(f"✗ LLM Error: {self.llm}")
        else:
            self.debug_info.append("✓ LLM configured successfully")
    
    @agent
    def chat_agent(self) -> Agent:
        """Create the main chat agent with proper tool configuration."""
        
        # Prepare agent backstory with tool awareness
        if self.available_tools:
            tool_list = ", ".join([getattr(tool, 'name', 'unnamed') for tool in self.available_tools])
            backstory = f"""You are Finly, an AI Assistant for Finova. 
            
            You have access to these tools: {tool_list}
            
            IMPORTANT TOOL USAGE GUIDELINES:
            - ALWAYS use tools when they can help answer the user's question
            - If asked about current date/time, use the current_date tool
            - If asked about company financial data, use company_financial_info tool
            - If asked about documents, use search_documents tool  
            - If asked about accounting research, use serper_accounting_research tool
            - Don't guess or assume data - use tools to get accurate information
            
            Be helpful, accurate, and always prefer tool data over assumptions."""
        else:
            backstory = """You are Finly, an AI Assistant for Finova. 
            Currently, no specialized tools are available, so provide helpful responses based on general knowledge.
            Always let users know when you need specific tools to provide accurate information."""

        agent_config = {
            'role': "Financial Chat Assistant",
            'goal': "Provide helpful, accurate, and context-aware responses to user queries by utilizing available tools whenever possible.",
            'backstory': backstory,
            'verbose': True,
            'allow_delegation': False,
            'tools': self.available_tools,  # Only assign tools to agent, not task
        }

        if not isinstance(self.llm, str):
            agent_config['llm'] = self.llm
            
        return Agent(**agent_config)
    
    @task
    def process_query_task(self) -> Task:
        """Create the task for processing user queries - let agent decide tool usage."""
        return Task(
            description="""
            Process the user's query and provide a helpful response.
            
            You have access to various tools - use them when they would help provide better, 
            more accurate information than general knowledge alone.
            
            Context Information:
            - Client Company EIN: {client_company_ein}
            - User Query: {user_query}
            - Recent Chat History: {chat_history}
            
            Provide a comprehensive and helpful response based on the user's query.
            """,
            agent=self.chat_agent(),
            expected_output="A helpful, accurate response that utilizes available tools when appropriate to provide the most relevant and up-to-date information."
            # Note: Removed tools parameter - let the agent handle tool selection
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
            # Prepare chat history string (limit to recent messages)
            chat_history_str = '\n'.join([
                f"{msg['role']}: {msg['content'][:200]}..." if len(msg['content']) > 200 else f"{msg['role']}: {msg['content']}"
                for msg in self.chat_history[-5:]  # Only last 5 messages for context
            ])
            
            # Create crew and process
            chat_crew = self.crew()
            
            inputs = {
                'client_company_ein': self.client_company_ein,
                'user_query': user_query,
                'chat_history': chat_history_str
            }
            
            # Add execution to debug info
            self.debug_info.append(f"🔄 Processing query: {user_query[:100]}...")
            
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
            
            # Limit chat history to prevent memory issues
            if len(self.chat_history) > 20:
                self.chat_history = self.chat_history[-20:]
            
            # Add success to debug info
            self.debug_info.append("✅ Query processed successfully")
            
            # Format debug info nicely
            debug_str = "\n\n" + "="*50 + "\nDEBUG INFO:\n" + "="*50 + "\n" + "\n".join(self.debug_info)
            
            return response + debug_str
            
        except Exception as e:
            error_msg = f"❌ I encountered an error: {str(e)}"
            self.debug_info.append(f"✗ Error: {str(e)}")
            self.debug_info.append(f"📋 Traceback: {traceback.format_exc()}")
            
            debug_str = "\n\n" + "="*50 + "\nDEBUG INFO:\n" + "="*50 + "\n" + "\n".join(self.debug_info)
            return error_msg + debug_str