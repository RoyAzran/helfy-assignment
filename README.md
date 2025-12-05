# TiDB Login App

A simple website with a Node.js backend and TiDB database, featuring a login screen and token-based authentication.

## Prerequisites

- Node.js installed
- A TiDB cluster (or MySQL database)

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Configure Database**:
    - Create a `.env` file in the root directory (a sample is provided).
    - Update the `TIDB_*` variables with your TiDB connection details.
    - Run the SQL script in `db/schema.sql` to create the `users` table and a test user.

3.  **Run the Server**:
    ```bash
    npm start
    ```

4.  **Access the App**:
    - Open your browser and go to `http://localhost:3000`.
    - Login with the test credentials:
        - Username: `admin`
        - Password: `admin`

## Project Structure

- `server.js`: Main Node.js/Express server.
- `public/`: Frontend files (HTML, CSS, JS).
- `db/`: Database schema scripts.
