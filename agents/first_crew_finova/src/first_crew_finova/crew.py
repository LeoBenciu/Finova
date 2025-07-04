from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai_tools import FileReadTool
from typing import List
# If you want to run a snippet of code before or after the crew starts,
# you can use the @before_kickoff and @after_kickoff decorators
# https://docs.crewai.com/concepts/crews#example-crew-class-with-decorators

@CrewBase
class FirstCrewFinova():
    """FirstCrewFinova crew"""

    agents: List[BaseAgent]
    tasks: List[Task]

    # Learn more about YAML configuration files here:
    # Agents: https://docs.crewai.com/concepts/agents#yaml-configuration-recommended
    # Tasks: https://docs.crewai.com/concepts/tasks#yaml-configuration-recommended
    
    # If you would like to add tools to your agents, you can learn more about it here:
    # https://docs.crewai.com/concepts/agents#agent-tools
    @agent
    def document_categorizer(self) -> Agent:
        return Agent(
            config=self.agents_config['document_categorizer'], 
            verbose=True,
            tools=[FileReadTool()]
        )

    @agent
    def invoice_data_extractor(self) -> Agent:
        return Agent(
            config=self.agents_config['invoice_data_extractor'],
            verbose=True,
            tools=[FileReadTool()]
        )
    
    @agent
    def other_document_data_extractor(self) -> Agent:
        return Agent(
            config=self.agents_config['other_document_data_extractor'],
            verbose=True,
            tools=[FileReadTool()]
        )

    # To learn more about structured task outputs,
    # task dependencies, and task callbacks, check out the documentation:
    # https://docs.crewai.com/concepts/tasks#overview-of-a-task
    @task
    def categorize_document_task(self) -> Task:
        return Task(
            config=self.tasks_config['categorize_document_task'], 
        )

    @task
    def extract_invoice_data_task(self) -> Task:
        return Task(
            config=self.tasks_config['extract_invoice_data_task'], 
            output_file='invoice_data.json'
        )

    @task
    def extract_other_document_data_task(self) -> Task:
        return Task(
            config=self.tasks_config['extract_other_document_data_task'], 
            output_file='other_document_data.json'
        )

    @crew
    def crew(self) -> Crew:
        """Creates the FirstCrewFinova crew"""
        # To learn how to add knowledge sources to your crew, check out the documentation:
        # https://docs.crewai.com/concepts/knowledge#what-is-knowledge

        return Crew(
            agents=self.agents, # Automatically created by the @agent decorator
            tasks=self.tasks, # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            # process=Process.hierarchical, # In case you wanna use that instead https://docs.crewai.com/how-to/Hierarchical/
        )
