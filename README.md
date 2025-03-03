## SOLMax

Features:
- Secure dashboard login.
- Bump buy with bonding curve check.
- Mirco buying with MEV support.
- Sell all tokens on Pump.fun.
- Sell all tokens on Raydium.
- Close Account.

Follow these steps to set up the project, configure environment variables, install dependencies, and run the server.
## 1. Install Project Dependencies

To install all the libraries and dependencies use this command:

`npm install`

## 2. Configure Environment Variables

a. Rename `.env.example` to `.env`

b. Define Variables in `.env`:

    # For development (Devnet)
      PRODUCTION=''

    # For production (Mainnet)
      PRODUCTION='mainnet'

## 3. Configure Login File in Pages

a. Rename `login.js.example` to `login.js`

## 3. Run the Server

To start the server use this command:

`node server.js`
