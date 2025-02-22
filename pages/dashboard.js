const {
  createToken,
  buyToken,
  sellAllToken,
  closeTokenAccount,
  sellAllTokenOnRay
} = require("../src/token/trade.js");
const {
  withdrawFromTraderWallet, getTraderAddress
} = require("../src/token/withdraw.js");
const { parse } = require("querystring");
const cookie = require("cookie");
const dotenv = require("dotenv");

dotenv.config();

let WITHDRAWAL_ADDRESS = process.env.WITHDRAWAL_ADDRESS || "";

module.exports = async (req, res) => {
  let cookies = cookie.parse(req.headers.cookie || "");

  if (!cookies.session) {
    res.writeHead(302, { Location: "/login" });
    return res.end();
  }

  if (req.method === "POST") {
    req.setEncoding("utf8");

    req.on("data", async (body) => {
      try {
        const parsedData = parse(body);
        const action = parsedData.action;
        const contractAddress = parsedData.contractAddress;

        let result;
        if (action === "withdraw") {
          result = await withdrawFromTraderWallet();
        } else if (action === "create") {
          result = await createToken();
        } else if (action === "buy") {
          const amount = parsedData.amount;
          const isBump = parsedData.isBump;
          if (isBump == "true") {
            result = await buyToken(contractAddress, amount, isBump);
          } else {
            buyToken(contractAddress, amount, isBump);
            result = 'Transaction sent successfully!'
          }
        } else if (action === "sellall") {
          result = await sellAllToken(contractAddress);
        } else if (action === "closeaccount") {
          result = await closeTokenAccount(contractAddress);
        } else if (action === "sellAllTokenOnRay") {
          result = await sellAllTokenOnRay(contractAddress);
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Invalid action");
        }

        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end(result);
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error: " + error.message);
      }
    });
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Token Pump - Dashboard</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f4f4f4; }
                    input, button { font-size: 20px; padding: 10px; margin: 10px; border-radius: 5px; }
                    button { cursor: pointer; border: none; }
                    .copyAddress { background-color: #28a745; color: white; }
                    .copyAddress:hover { background-color: #218838; }
                    .withdraw { background-color: #dc3545; color: white; }
                    .withdraw:hover { background-color: #c82333; }
                    .buy { background-color: #218838; color: white; }
                    .buy:hover { background-color:rgb(28, 117, 48); }
                    .sellall { background-color: #dc3545; color: white; }
                    .sellall:hover { background-color: #c82333; }
                    #output { margin-top: 20px; font-weight: bold; }
                    .success { color: green; }
                    .error { color: red; }
                </style>
            </head>
            <body>
                <h4>Trader Address: ${ getTraderAddress() }</h4>
                <h4>Withdrawal Address: ${WITHDRAWAL_ADDRESS}</h4>
                <button id="withdrawBtn" class="withdraw">Withdraw from Trader</button>
                <br>
                <br>
                <input type="text" id="contractAddress" placeholder="Enter Contract Address For Buy/Sell" style="width: 80%;">
                <br>
                <button class="buy" onclick="handleBuy(50, true)">Bump Buy 50 SOL</button>
                <button class="buy" onclick="handleBuy(0.005, true)">Bump Buy 0.005 SOL</button>
                <br>
                <button class="buy" onclick="handleBuy(0.001)">0.001 SOL</button>
                <button class="buy" onclick="handleBuy(0.005)">0.005 SOL</button>
                <button class="buy" onclick="handleBuy(0.01)">0.01 SOL</button>
                <button class="buy" onclick="handleBuy(0.05)">0.05 SOL</button>
                <button class="buy" onclick="handleBuy(0.1)">0.1 SOL</button>
                <button class="buy" onclick="handleBuy(0.2)">0.2 SOL</button>
                <button class="buy" onclick="handleBuy(0.5)">0.5 SOL</button>
                <button class="buy" onclick="handleBuy(0.8)">0.8 SOL</button>
                <button class="buy" onclick="handleBuy(1)">1 SOL</button>
                <button class="buy" onclick="handleBuy(2)">2 SOL</button>
                <br>
                <button id="sellAllBtn" class="sellall">Sell All</button>
                <br>
                <button id="closeAccountBtn" class="sellall">Close Account</button>
                <br>
                <button id="sellAllTokenOnRay" class="sellall">Sell All On Ray</button>
                <p id="output"></p>

                <script>
                    async function handleAction(action, contractAddress = "", amount = 0, isBump = false) {
                        const output = document.getElementById('output');
                        output.textContent = "Processing...";

                        const data = new URLSearchParams();
                        data.append('action', action);
                        data.append('contractAddress', contractAddress);
                        data.append('isBump', isBump.toString());
                        data.append('amount', amount.toString());

                        try {
                            let response = await fetch("/dashboard", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: data.toString()
                        });

                        if (response.ok) {
                            const text = await response.text(); // Await the response text
                            output.innerHTML = text;
                            output.className = "success";
                        } else {
                            const errorText = await response.text(); // Capture error message from response
                            output.innerHTML = "Error: " + errorText;
                            output.className = "error";
                        }
                        } catch (error) {
                            console.error('Fetch error:', error); // Log the error to the console
                            output.textContent = "Error: Unable to process request." + error.message;
                            output.className = "error";
                        }
                    }
                    

                    document.getElementById('withdrawBtn').addEventListener('click', function() {
                        if (confirm("Are you sure you want to withdraw?")) {
                              handleAction("withdraw");
                        }
                    });

                    function handleBuy(amount, isBump = false) {
                        const contractAddress = document.getElementById('contractAddress').value;
                        if (!contractAddress) {
                            output.innerHTML = "Error: Contract address is required";
                            output.className = "error";
                            return;
                        }
                        handleAction("buy", contractAddress, amount, isBump);
                    }

                    document.getElementById('sellAllBtn').addEventListener('click', function() {
                        const contractAddress = document.getElementById('contractAddress').value;
                        if (!contractAddress) {
                            output.innerHTML = "Error: Contract address is required";
                            output.className = "error";
                            return;
                        }
                        handleAction("sellall", contractAddress);
                    });

                    document.getElementById('closeAccountBtn').addEventListener('click', function() {
                        const contractAddress = document.getElementById('contractAddress').value;
                        if (!contractAddress) {
                            output.innerHTML = "Error: Contract address is required";
                            output.className = "error";
                            return;
                        }
                        handleAction("closeaccount", contractAddress);
                    });

                    document.getElementById('sellAllTokenOnRay').addEventListener('click', function() {
                        const contractAddress = document.getElementById('contractAddress').value;
                        if (!contractAddress) {
                            output.innerHTML = "Error: Contract address is required";
                            output.className = "error";
                            return;
                        }
                        handleAction("sellAllTokenOnRay", contractAddress);
                    });
                </script>
            </body>
            </html>
        `);
  }
};
