const CONFIG = {
    API_ENDPOINTS: {
        session: 'http://localhost:8888/session',
        order: 'http://localhost:8888/order',
        menu: 'http://localhost:8888/menu',
        realtime: 'https://api.openai.com/v1/realtime'
    },
    MODEL: 'gpt-4o-realtime-preview-2024-12-17',
    VOICE: 'echo',
    VOICES: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'],
    INITIAL_MESSAGE: {
        text: 'Welcome to our drive-thru! What can I get for you today?'
    },
    TOOLS: [
        {
            type: 'function',
            name: 'take_order',
            description: 'Records a customer\'s order',
            parameters: {
                type: 'object',
                properties: {
                    order: {
                        type: 'string',
                        enum: ["burger", "fries", "nuggets", "coke"],
                        description: 'The customer\'s order in natural language'
                    },
                    quantity: {
                        type: 'integer',
                        description: 'The quantity of the ordered item',
                        default: 1
                    }
                },
                required: ['order', 'quantity']
            }
        },
        {
            type: 'function',
            name: 'remove_order',
            description: 'Removes a selected item from the customer\'s order',
            parameters: {
                type: 'object',
                properties: {
                    order: {
                        type: 'string',
                        description: 'The name of the item to remove from the order'
                    },
                    quantity: {
                        type: 'integer',
                        description: 'The quantity of the item to remove'
                    }
                },
                required: ['order']
            }
        },
        {
            type: 'function',
            name: 'get_menu_details',
            description: 'Fetches details about a specific menu',
            parameters: {
                type: 'object',
                properties: {
                    menu: {
                        type: 'string',
                        enum: ["burger", "fries", "nuggets", "coke"],
                        description: 'The name of the menu to get details for'
                    }
                },
                required: ['menu']
            }
        },
        {
            type: 'function',
            name: 'summarize_order',
            description: 'Summarizes the current order, listing all items and total cost. Only call this function when the user explicitly requests an order summary.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        },
        {
            type: 'function',
            name: 'finalize_order',
            description: 'Finalizes the order when the customer is ready to checkout',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    ]
};

window.CONFIG = CONFIG;