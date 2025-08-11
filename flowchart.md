```mermaid
graph TD
    subgraph User Authentication
        A[User visits site] --> B{Has Account?};
        B -- No --> C[Fills Registration Form (name, email, password)];
        C --> D[POST /auth/register];
        D --> E{First User?};
        E -- Yes --> F[Create Client, is_admin = true];
        E -- No --> G[Create Client, is_admin = false];
        F & G --> H[Hash Password, Generate API Key, Save to DB];
        H --> I[Show Success, please login];
        I --> J[User visits Login Page];
        B -- Yes --> J;
        J --> K[Fills Login Form (email, password)];
        K --> L[POST /auth/login];
        L --> M[User Exists & Password Matches?];
        M -- No --> N[Show Invalid Credentials];
        M -- Yes --> O[Generate JWT (with isAdmin status)];
        O --> P{isAdmin?};
        P -- Yes --> Q[Redirect to Admin Dashboard];
        P -- No --> R[Redirect to Client Dashboard];
    end

    subgraph Client Action (e.g., Send SMS)
        S[Client on Dashboard] --> T[Fills Send SMS Form];
        T --> U[JS sends POST /api/sendsms with JWT];
        U --> V[API Middleware Authenticates Token];
        V --> W{Token Valid?};
        W -- No --> X[Return 401/403 Error];
        W -- Yes --> Y[API Logic: Get Client from DB];
        Y --> Z{Balance > SMS_TOKEN_COST?};
        Z -- No --> AA[Return 402 Error - Insufficient Tokens];
        Z -- Yes --> AB[Call Africa's Talking SMS API];
        AB --> AC{AT API Success?};
        AC -- Yes --> AD[Deduct Tokens & Log SMS to DB];
        AD --> AE[Return Success Response to Client];
        AC -- No --> AE;
    end

    subgraph Admin Action (e.g., Top-Up)
        Q --> B1[Admin on Dashboard];
        B1 --> B2[Fills Top-Up Form (clientId, amount)];
        B2 --> B3[JS sends POST /api/admin/topup with Admin JWT];
        B3 --> B4[API Middleware Authenticates Token & Admin status];
        B4 --> B5{Valid Admin?};
        B5 -- No --> X;
        B5 -- Yes --> B6[API Logic: Increment Client's token_balance in DB];
        B6 --> B7[Return Success Response];
        B7 --> B8[JS refreshes Client List on dashboard];
    end

    subgraph USSD Flow
        C1[User Dials USSD Code] --> C2[Africa's Talking Platform];
        C2 --> C3[POST to your /ussd_callback URL];
        C3 --> C4[API Logic: Find Client by ussd_code];
        C4 --> C5[Create 'Pending' log in ussd_logs DB];
        C5 --> C6[Process User Input (text from AT)];
        C6 --> C7[Generate CON or END Response];
        C7 --> C2;
        C2 -- Session Ends --> C8[POST to your /ussd_events_callback URL];
        C8 --> C9[API Logic: Find Session, Calculate Cost, Update Log, Deduct Tokens];
        C9 --> C10[Process Complete];
    end