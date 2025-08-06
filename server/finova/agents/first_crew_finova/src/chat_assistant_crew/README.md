# Chat Assistant Crew

A specialized AI crew for handling financial chat interactions within the Finova application.

## Overview

The Chat Assistant Crew is responsible for processing user queries, analyzing financial documents, and providing helpful responses based on the user's financial context.

## Features

- Process natural language queries about financial data
- Maintain conversation context with chat history
- Analyze financial documents to extract relevant information
- Retrieve and analyze financial data

## Installation

1. Make sure you have Python 3.8+ installed
2. Install the required dependencies:
   ```bash
   pip install -r ../../chat_assistant_requirements.txt
   ```

## Usage

```python
from chat_assistant_crew.crew import ChatAssistantCrew

# Initialize the chat assistant
chat_crew = ChatAssistantCrew(client_company_ein="your_client_ein")

# Process a user message
response = chat_crew.process_message("What were my recent transactions?")
print(response)

# The chat history is maintained in the instance
print(chat_crew.chat_history)
```

## Configuration

### Agents

Agents are configured in `config/agents.yaml`. The following agents are available:

- `chat_agent`: Main agent for processing user queries
- `document_analyzer_agent`: Specialized in analyzing financial documents
- `data_retrieval_agent`: Handles retrieving and analyzing financial data

### Tasks

Tasks are defined in `config/tasks.yaml` and include:

- `process_chat_message_task`: Process general chat messages
- `analyze_document_task`: Analyze financial documents
- `retrieve_financial_data_task`: Retrieve and analyze financial data

## Development

To modify the chat assistant crew:

1. Update the agent configurations in `config/agents.yaml`
2. Modify task definitions in `config/tasks.yaml`
3. Extend the `ChatAssistantCrew` class in `crew.py` for additional functionality

## Testing

Run the test suite with:

```bash
pytest tests/
```

## License

This project is part of the Finova application.
