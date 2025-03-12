const state = {
    orders: [],  // Stores the list of orders
    total: 0     // Stores the total cost of all orders
};

// UI Management
class UI {
    static elements = {
        startButton: document.getElementById('startButton'),
        stopButton: document.getElementById('stopButton'),
        clearButton: document.getElementById('clearButton'),
        voiceSelect: document.getElementById('voiceSelect'),
        transcript: document.getElementById('transcript'),
        status: document.getElementById('status'),
        error: document.getElementById('error'),
        imageContainer: document.getElementById('imageContainer'),
        contentWrapper: document.querySelector('.content-wrapper'),
        orderDetails: document.getElementById('orderDetails'),
        totalAmount: document.getElementById('totalAmount')
    };

    static updateStatus(message) {
        this.elements.status.textContent = message;
    }

    static showError(message) {
        this.elements.error.style.display = 'block';
        this.elements.error.textContent = message;
    }

    static hideError() {
        this.elements.error.style.display = 'none';
    }

    static updateTranscript(message, type = 'assistant') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        messageDiv.textContent = message;
        
        if (this.elements.transcript.firstChild) {
            this.elements.transcript.insertBefore(messageDiv, this.elements.transcript.firstChild);
        } else {
            this.elements.transcript.appendChild(messageDiv);
        }
    }

    static clearConversation() {
        this.elements.transcript.innerHTML = '';
        this.hideError();
        state.orders = [];
        state.total = 0;
        this.clearOrderSummary();
        this.updateStatus('Ready to start');
    }

    static clearOrderSummary() {
        this.elements.orderDetails.innerHTML = '';
        this.elements.totalAmount.textContent = 'Total: $0.00';
    }

    static updateButtons(isConnected) {
        this.elements.startButton.disabled = isConnected;
        this.elements.stopButton.disabled = !isConnected;
    }

    static updateOrderSummary() {
        // Clear current summary
        this.clearOrderSummary();

        // Re-render the orders in state
        state.orders.forEach(orderItem => {
            const orderDiv = document.createElement('div');
            orderDiv.className = 'order-item';
            orderDiv.textContent = `${orderItem.quantity} x ${orderItem.name} - $${(orderItem.price * orderItem.quantity).toFixed(2)}`;
            this.elements.orderDetails.appendChild(orderDiv);
        });

        // Update the total
        this.elements.totalAmount.textContent = `Total: $${state.total.toFixed(2)}`;
    }

    static updateVoiceSelector(enabled) {
        this.elements.voiceSelect.disabled = !enabled;
    }
}

// Error Handler
class ErrorHandler {
    static handle(error, context) {
        console.error(`Error in ${context}:`, error);
        UI.showError(`Error ${context}: ${error.message}`);
    }
}

// Message Handler
class MessageHandler {
    static async handleTranscript(message) {
        const transcript = message.response?.output?.[0]?.content?.[0]?.transcript;
        if (transcript) {
            UI.updateTranscript(transcript);
        }
    }

    static async handleOrderFunction(output) {
        try {
            const args = JSON.parse(output.arguments);
        
            const response = await fetch(`${CONFIG.API_ENDPOINTS.order}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ order: args.order, quantity: args.quantity })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || "Failed to place order");
            }
            const orderItem = {
                name: data.name,
                quantity: data.quantity,
                price: data.price
            };

            state.orders.push(orderItem);
            state.total += orderItem.price * orderItem.quantity;
            UI.updateOrderSummary();

            return {
                message: `Added ${orderItem.quantity} x ${orderItem.name} to order.`,
                orderItem
            };
        } catch (error) {
            ErrorHandler.handle(error, 'Order Function');
            if (error.message.includes("not found in menu")) {
                return `Error: ${error.message}`;
            }
            return "Could not process order";
        }
    }

    static async handleRemoveOrderFunction(output) {
        try {
            const args = JSON.parse(output.arguments);
            const { order, quantity } = args;
            
            const orderItemIndex = state.orders.findIndex(item => item.name === args.order);
            if (orderItemIndex === -1) {
                return {
                    message: `Item '${order}' not found in current order.`
                };
            }

            const orderItem = state.orders[orderItemIndex];

            // If requested quantity is less than the ordered quantity, adjust it
            if (orderItem.quantity >= quantity) {
                orderItem.quantity -= quantity;
                state.total -= orderItem.price * quantity;
                UI.updateOrderSummary();

                return {
                    message: `Reduced quantity of ${orderItem.name} by ${quantity}.`,
                    orderItem
                };
            } else {
                state.orders.splice(orderItemIndex, 1);
                state.total -= orderItem.price * orderItem.quantity;
                UI.updateOrderSummary();

                return {
                    message: `Removed all of ${orderItem.name} from the order.`,
                    orderItem
                };
            }
            
        } catch (error) {
            ErrorHandler.handle(error, 'Remove Order Function');
            return "Could not remove item from order";
        }
    }

    static async handleGetMenuDetailsFunction(output) {
        try {
            const args = JSON.parse(output.arguments);
            const response = await fetch(`${CONFIG.API_ENDPOINTS.menu}/${encodeURIComponent(args.menu)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            if (response.ok) {
                return {
                    message: `Menu details retrieved successfully.`,
                    menuDetails: data
                };
            } else {
                return {
                    message: `Failed to retrieve menu details.`,
                    error: data.error
                };
            }
        } catch (error) {
            ErrorHandler.handle(error, 'Get Menu Details Function');
            return "Could not fetch menu details";
        }
    }

    static async handleSummarizeOrder() {
        if (state.orders.length === 0) {
            return { message: "Your order is currently empty." };
        }

        let summary = "Your order summary:\n";
        state.orders.forEach(order => {
            summary += `- ${order.quantity} x ${order.name} ($${(order.price * order.quantity).toFixed(2)})\n`;
        });

        summary += `Total: $${state.total.toFixed(2)}`;

        return { message: summary };
    }

    static async handleFinalizeOrder() {
        if (state.orders.length === 0) {
            return { message: "No items in order to finalize." };
        }
        const finalOrder = state.orders.map(order => `${order.quantity} x ${order.name}`).join(", ");
        const totalPrice = state.total.toFixed(2);


        return { message: `Your order has been finalized: ${finalOrder}. Total: $${totalPrice}. Please proceed to payment.` };
    }
}

// WebRTC Manager
class WebRTCManager {
    constructor(app) {
        this.peerConnection = null;
        this.audioStream = null;
        this.dataChannel = null;
        this.app = app;  // Store reference to the app
    }
    

    async setupAudio() {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        this.peerConnection.ontrack = e => audioEl.srcObject = e.streams[0];
        
        this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.peerConnection.addTrack(this.audioStream.getTracks()[0]);
    }

    setupDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('oai-events');
        this.dataChannel.onopen = () => this.onDataChannelOpen();
        this.dataChannel.addEventListener('message', (event) => this.handleMessage(event));
    }

    async handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log('Received message:', message);
            
            if (message.type === 'response.done') {
                await MessageHandler.handleTranscript(message);
                const output = message.response?.output?.[0];
                if (output?.type === 'function_call' && output?.call_id) {
                    console.log("Call Function: ", output.name)
                    let result;
                    if (output.name === 'take_order') {
                        result = await MessageHandler.handleOrderFunction(output);
                    } else if (output.name === 'remove_order') {
                        result = await MessageHandler.handleRemoveOrderFunction(output);
                    } else if (output.name === 'get_menu_details') {
                        result = await MessageHandler.handleGetMenuDetailsFunction(output);
                    } else if (output.name === 'summarize_order') {
                        result = await MessageHandler.handleSummarizeOrder(output);
                    } else if (output.name === 'finalize_order') {
                        result = await MessageHandler.handleFinalizeOrder(output);
                    }
                    
                    if (result) {
                        this.sendFunctionOutput(output.call_id, result);
                        this.sendResponseCreate();
                    }
                }
            }
        } catch (error) {
            ErrorHandler.handle(error, 'Message Processing');
        }
    }

    sendMessage(message) {
        if (this.dataChannel?.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
            console.log('Sent message:', message);
        }
    }

    sendSessionUpdate() {
        this.sendMessage({
            type: "session.update",
            session: {
                voice: this.app.currentVoice,
                tools: CONFIG.TOOLS,
                tool_choice: "auto"
            }
        });
    }

    sendInitialMessage() {
        this.sendMessage({
            type: 'conversation.item.create',
            previous_item_id: null,
            item: {
                id: 'msg_' + Date.now(),
                type: 'message',
                role: 'user',
                content: [{
                    type: 'input_text',
                    text: CONFIG.INITIAL_MESSAGE.text
                }]
            }
        });
    }

    sendFunctionOutput(callId, data) {
        this.sendMessage({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify(data)
            }
        });
    }

    sendResponseCreate() {
        this.sendMessage({ type: 'response.create' });
    }

    onDataChannelOpen() {
        this.sendSessionUpdate();
        this.sendInitialMessage();
    }

    cleanup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
    }
}

// Main Application
class App {
    constructor() {
        this.webrtc = null;
        this.currentVoice = CONFIG.VOICE;
        this.bindEvents();
    }

    bindEvents() {
        UI.elements.startButton.addEventListener('click', () => this.init());
        UI.elements.stopButton.addEventListener('click', () => this.stop());
        UI.elements.clearButton.addEventListener('click', () => UI.clearConversation());
        UI.elements.voiceSelect.addEventListener('change', (e) => {
            if (!this.webrtc) {
                this.currentVoice = e.target.value;
            } else {
                e.target.value = this.currentVoice;
            }
        });
        document.addEventListener('DOMContentLoaded', () => {
            UI.updateStatus('Ready to start');
            UI.elements.voiceSelect.value = this.currentVoice;
        });
    }

    async init() {
        UI.elements.startButton.disabled = true;
        UI.updateVoiceSelector(false);
        
        try {
            UI.updateStatus('Initializing...');
            
            const tokenResponse = await fetch(`${CONFIG.API_ENDPOINTS.session}?voice=${this.currentVoice}`);
            if (!tokenResponse.ok) {
                throw new Error('Could not establish session');
            }

            const data = await tokenResponse.json();
            if (!data.client_secret?.value) {
                throw new Error('Could not establish session');
            }

            const EPHEMERAL_KEY = data.client_secret.value;

            this.webrtc = new WebRTCManager(this);
            this.webrtc.peerConnection = new RTCPeerConnection();
            await this.webrtc.setupAudio();
            this.webrtc.setupDataChannel();

            const offer = await this.webrtc.peerConnection.createOffer();
            await this.webrtc.peerConnection.setLocalDescription(offer);

            const sdpResponse = await fetch(`${CONFIG.API_ENDPOINTS.realtime}?model=${CONFIG.MODEL}`, {
                method: 'POST',
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    'Content-Type': 'application/sdp'
                },
            });
            
            if (!sdpResponse.ok) {
                throw new Error('Could not establish connection');
            }

            const sdpText = await sdpResponse.text();
            if (!sdpText) {
                throw new Error('Could not establish connection');
            }

            const answer = {
                type: 'answer',
                sdp: sdpText,
            };
            await this.webrtc.peerConnection.setRemoteDescription(answer);

            UI.updateStatus('Connected');
            UI.updateButtons(true);
            UI.updateVoiceSelector(true);
            UI.hideError();

        } catch (error) {
            UI.updateButtons(false);
            UI.updateVoiceSelector(true);
            ErrorHandler.handle(error, 'Initialization');
            UI.updateStatus('Failed to connect');
        }
    }

    stop() {
        if (this.webrtc) {
            this.webrtc.cleanup();
            this.webrtc = null;
        }
        UI.updateButtons(false);
        UI.updateVoiceSelector(true);
        UI.updateStatus('Ready to start');
    }
}

// Initialize the application
const app = new App(); 