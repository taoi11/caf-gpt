# Email-Based UX Redesign

## Overview
This document outlines the plan to transition the CAF-GPT application from a web-based UI to an email-driven interaction model. Users will interact with the system by sending emails to specific addresses (e.g., `pacenote@caf-gpt.com`, `policyfoo@caf-gpt.com`). The system will use IMAP to monitor these inboxes, process emails, and send replies.

## Key Changes
- **UI Removal**: The existing web-based UI will be removed.
- **Email Input**: Users will send emails to trigger actions.
- **IMAP Listener**: The server will use IMAP to monitor inboxes.
- **Email Processing**: Emails will be processed sequentially.
- **Email Output**: Replies will be sent via email.

## Core Components
1.  **IMAP Listener**:
    -   Monitors specified email inboxes.
    -   Adds new emails to a processing queue.
    -   Handles authentication and connection.
2.  **Email Parser**:
    -   Extracts relevant information from emails (e.g., subject, body, sender).
    -   Formats data for the LLM workflow.
3.  **LLM Workflow**:
    -   Processes email content using existing LLM agents.
    -   Generates responses based on the email content.
4.  **Email Composer**:
    -   Formats LLM responses into email replies.
    -   Sends replies to the original sender.
5.  **Queue Management**:
    -   Manages the queue of incoming emails.
    -   Ensures emails are processed in order.
    -   Handles errors and retries.

## Email Addresses
-   `pacenote@caf-gpt.com`: For Pace Notes requests.
-   `policyfoo@caf-gpt.com`: For Policy Tool requests.

## Data Flow
1.  **Email Received**: An email is sent to one of the designated addresses.
2.  **IMAP Listener**: The IMAP listener detects the new email.
3.  **Queue Addition**: The email is added to the processing queue.
4.  **Email Parsing**: The email is parsed to extract relevant data.
5.  **LLM Processing**: The data is sent to the appropriate LLM agent.
6.  **Response Generation**: The LLM agent generates a response.
7.  **Email Composition**: The response is formatted into an email reply.
8.  **Reply Sent**: The reply is sent to the original sender.

## Considerations
-   **Security**: Secure handling of email credentials using environment variables or secure vaults.
-   **Error Logging**: Implement robust error logging to a persistent and secure location.
-   **Error Handling**: Robust error handling for email processing.
-   **Rate Limiting**: Apply rate limiting to email processing.
-   **Scalability**: Design for handling multiple concurrent emails.
-   **Email Formatting**: Define clear email formatting guidelines for users.
-   **Email Retries and Failures**: Implement mechanisms for handling retries and notifying users if processing fails.
-   **User Feedback**: Provide users with feedback on processing status, such as confirmation receipts and error notifications.

## Dependencies
-   `imap`: For IMAP operations.
-   `nodemailer`: For sending email replies.

## Next Steps
1.  **Research**: Investigate IMAP libraries for Node.js.
2.  **Prototyping**: Create a basic IMAP listener and email parser.
3.  **Integration**: Integrate the email processing with the existing LLM workflow.
4.  **Testing**: Thoroughly test the email-based interaction model.
