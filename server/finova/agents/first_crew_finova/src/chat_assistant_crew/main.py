"""
Main entry point for the Chat Assistant Crew.

This module provides a command-line interface for interacting with the Chat Assistant Crew.
"""

import argparse
import json
from typing import Dict, List, Optional

from dotenv import load_dotenv

from .crew import ChatAssistantCrew

def main():
    """Run the Chat Assistant Crew with command-line arguments."""
    # Load environment variables from .env file
    load_dotenv()
    
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Chat Assistant Crew')
    parser.add_argument('--client-ein', type=str, required=True,
                      help='Client company EIN')
    parser.add_argument('--chat-history', type=str, default=None,
                      help='Path to JSON file with chat history')
    parser.add_argument('--interactive', action='store_true',
                      help='Run in interactive mode')
    
    args = parser.parse_args()
    
    # Load chat history if provided
    chat_history: List[Dict] = []
    if args.chat_history:
        try:
            with open(args.chat_history, 'r', encoding='utf-8') as f:
                chat_history = json.load(f)
            print(f"Loaded chat history from {args.chat_history}")
        except Exception as e:
            print(f"Error loading chat history: {e}")
    
    # Initialize the chat assistant
    print(f"Initializing Chat Assistant for client EIN: {args.client_ein}")
    chat_crew = ChatAssistantCrew(
        client_company_ein=args.client_ein,
        chat_history=chat_history
    )
    
    if args.interactive:
        # Interactive mode
        print("\nChat Assistant is ready! Type 'exit' or 'quit' to end the session.")
        print("Type 'clear' to clear the chat history.\n")
        
        while True:
            try:
                user_input = input("You: ").strip()
                
                if user_input.lower() in ('exit', 'quit'):
                    print("\nGoodbye!")
                    break
                elif user_input.lower() == 'clear':
                    chat_crew.chat_history = []
                    print("Chat history cleared.\n")
                    continue
                
                # Process the user's message
                response = chat_crew.process_message(user_input)
                print(f"\nAssistant: {response}\n")
                
            except KeyboardInterrupt:
                print("\nGoodbye!")
                break
            except Exception as e:
                print(f"\nError: {e}\n")
    else:
        # Single message mode (non-interactive): read one message from stdin safely
        if not args.chat_history:
            print("No chat history provided. Starting a new conversation.")

        try:
            # Read one line from stdin written by the Node process
            import sys
            raw = sys.stdin.readline()
            user_input = (raw or "").strip()
        except Exception:
            user_input = ""

        if user_input:
            response = chat_crew.process_message(user_input)
            print(f"\nAssistant: {response}")
        else:
            # Graceful no-input behavior to avoid non-zero exit & Node fallback
            print("Assistant: No input provided.")
    
    # Save chat history if needed
    if args.chat_history:
        try:
            with open(args.chat_history, 'w', encoding='utf-8') as f:
                json.dump(chat_crew.chat_history, f, indent=2)
            print(f"\nChat history saved to {args.chat_history}")
        except Exception as e:
            print(f"Error saving chat history: {e}")

if __name__ == "__main__":
    main()
