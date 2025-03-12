from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv(override=True)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
REALTIME_SESSION_URL = os.getenv("REALTIME_SESSION_URL")

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY not found in environment variables")
if not REALTIME_SESSION_URL:
    raise ValueError("REALTIME_SESSION_URL not found in environment variables")

MENU = {
    "burger": 5.99,
    "fries": 2.99,
    "coke": 1.99,
    "nuggets": 4.99
}

class TakeOrderRequest(BaseModel):
    order: str
    quantity: int

class TakeOrderResponse(BaseModel):
    name: str
    quantity: int
    price: float

class RemoveOrderRequest(BaseModel):
    order: str
    quantity: int

class RemoveOrderResponse(BaseModel):
    name: str
    quantity: int
    price: float

class GetMenuDetailResponse(BaseModel):
    name: str
    price: float

@app.get("/session")
async def get_session(voice: str = "alloy"):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                REALTIME_SESSION_URL,
                headers={
                    'Authorization': f'Bearer {OPENAI_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    "model": "gpt-4o-realtime-preview-2024-12-17",
                    "voice": voice,
                    "instructions": """
                    You are a Drive-Thru Order Assistant. Your job is to take customer orders, summarize them, suggest additional items, and calculate the total price. 

                    When a customer places an order:
                    - Recognize menu items.
                    - Store the order details.
                    - Suggest an additional item (upsell).
                    - Always confirm the final order and total price before completing the transaction.

                    If asked about the menu, retrieve it from the knowledge source. If it is not found say you don't know.
                    You can only respond in English, French, Dutch, or German. Always reply in the same language as the customer's question. If the question is in a language outside these four, inform the customer that you can only respond in one of these languages.
                    """
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error occurred: {e.response.status_code}")
        return JSONResponse(status_code=e.response.status_code, content={"error": str(e)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Internal Server Error", "details": str(e)})

@app.post("/order")
async def take_order(request: TakeOrderRequest):
    try:
        item_name = request.order
        quantity = request.quantity
        selected_order = ""
        selected_price = 999.99
        
        if item_name in MENU:
            selected_order = item_name
            selected_price = MENU[item_name]

        if not selected_order:
            return JSONResponse(status_code=400, content={"error": "No valid items found in order."})
        
        return TakeOrderResponse(
            name=selected_order,
            quantity=quantity,
            price=selected_price
        )
    except Exception as e:
        logger.error(f"Error processing order: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not process order: {str(e)}"})


@app.post("/order/remove")
async def remove_order(request: RemoveOrderRequest):
    try:
        item_name = request.order
        quantity = request.quantity

        selected_order = ""
        selected_price = 999.99
        
        if item_name in MENU:
            selected_order = item_name
            selected_price = MENU[item_name]

        if not selected_order:
            return JSONResponse(status_code=400, content={"error": "No valid items found in order."})

        return RemoveOrderResponse(
            name=selected_order,
            quantity=quantity,
            price=selected_price
        )

    except Exception as e:
        logger.error(f"Error processing remove order: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not remove order: {str(e)}"})

@app.get("/menu/{item_name}")
async def get_item_details(item_name: str):
    try:
        if item_name not in MENU:
            return JSONResponse(status_code=400, content={"error": f"Item '{item_name}' not found in menu."})

        return GetMenuDetailResponse(
            name=item_name,
            price=MENU[item_name]
        )
    except Exception as e:
        logger.error(f"Error fetching item details: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Could not fetch item details: {str(e)}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8888)
