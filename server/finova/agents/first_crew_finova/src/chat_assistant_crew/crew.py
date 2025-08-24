from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Optional
import os
import sys
from first_crew_finova.tools.serper_tool import get_serper_tool
from first_crew_finova.tools.backend_tool import get_backend_tools

class ChatAssistantCrew:
    """
    Chat Assistant Crew for handling user queries and providing intelligent responses.
    """
    
    def __init__(self, client_company_ein: str, chat_history: List[Dict] = None):
        self.client_company_ein = client_company_ein
        self.chat_history = chat_history or []
        self.llm = self._get_configured_llm()
    
    def _get_configured_llm(self):
        """Get properly configured LLM for the chat assistant."""
        from langchain.chat_models import ChatOpenAI
        
        return ChatOpenAI(
            model_name="gpt-4-turbo-preview",
            temperature=0.7,
            max_tokens=2000
        )
    
    def chat_agent(self) -> Agent:
        """Create the main chat agent with optional research tools (Serper)."""
        tools = []
        # Attach Serper research tool if SERPER_API_KEY is available
        serper = get_serper_tool()
        if serper:
            tools.append(serper)
        # Attach backend tools if backend URL and JWT are available
        try:
            tools.extend(get_backend_tools())
        except Exception:
            pass

        try:
            serper_present = 'yes' if os.getenv('SERPER_API_KEY') else 'no'
            print(f"[ChatAssistant] Tools enabled: {[getattr(t, 'name', type(t).__name__) for t in tools]} | SERPER_API_KEY present: {serper_present}")
        except Exception:
            pass

        return Agent(
            role="Financial Chat Assistant",
            goal="Provide helpful, accurate, and context-aware responses to user queries about financial data and documents.",
            backstory="""
            You are Finly and AI Assistant for the Finova (A platform for romanian accounting companies powered by AI), specialized in Romanian accounting and financial matters, helping users with:
                - understand their financial data
                -finding documents for them
                -providing insights
                -create and send email to customers
                -calculate tax related things
                -create tasks
                -doing research related to the accounting sector in Romania
            You have access to the user's financial context and can help with
            questions about transactions, documents, and financial analysis.
            """,
            verbose=True,
            tools=tools,
            llm=self.llm
        )
    
    def process_query_task(self, user_query: str, chat_history: str) -> Task:
        """Create the task for processing user queries."""
        return Task(
            description=f"""
            Analyze the user's query and provide a helpful response. Consider the chat history for context.

            User Query: {user_query}

            Chat History:
            {chat_history}

            Available tools:
            - company_financial_info: Fetches live company data for the current client (EIN) from the Finova backend.
              Topics: summary, accounts, outstanding, balance, audit. Prefer this for company-specific info.
            - serper_accounting_research: Web research for Romanian accounting updates; use only for general info.

            Guidelines:
            - If the user asks about this company's financials (e.g., "prezintă-mi informațiile financiare ale acestei firme"),
              call company_financial_info with an appropriate topic (start with 'summary'; include others if relevant) and synthesize the results.
            - If backend data is unavailable, state that clearly and provide general guidance instead of hallucinating.
            - Keep answers concise and actionable. Use Romanian when the user's input is Romanian.

            """,
            agent=self.chat_agent(),
            expected_output="A helpful and accurate response to the user's query.",
        )
    
    def process_message(self, user_query: str) -> str:
        """Process a user message and return a response."""
        chat_history_str = '\n'.join([f"{msg['role']}: {msg['content']}" for msg in self.chat_history])
        task = self.process_query_task(user_query, chat_history_str)
        
        crew = Crew(
            agents=[self.chat_agent()],
            tasks=[task],
            verbose=True
        )
        
        result = crew.kickoff({
            'user_query': user_query,
            'chat_history': chat_history_str
        })
        
        # Update chat history
        self.chat_history.append({"role": "user", "content": user_query})
        self.chat_history.append({"role": "assistant", "content": result})
        
        return result
