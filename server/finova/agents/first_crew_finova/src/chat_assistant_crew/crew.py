from crewai import Agent, Crew, Task, LLM
from crewai.project import CrewBase, agent, crew, task
from typing import Dict, List, Optional
import os
import sys

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
        """Create the main chat agent."""
        return Agent(
            role="Financial Chat Assistant",
            goal="Provide helpful, accurate, and context-aware responses to user queries about financial data and documents.",
            backstory="""
            You are an AI assistant specialized in financial matters, helping users understand their financial data,
            documents, and providing insights. You have access to the user's financial context and can help with
            questions about transactions, documents, and financial analysis.
            """,
            verbose=True,
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
            
            Provide a clear, concise, and accurate response. If the query requires specific data or actions,
            explain what would be needed to fulfill the request.
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
