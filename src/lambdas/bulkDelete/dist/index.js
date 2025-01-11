"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const stepFunctions = new aws_sdk_1.default.StepFunctions();
const handler = async (event, context) => {
    try {
        // AppSync -> Lambda: event.arguments.codes (array de strings)
        const { codes } = event.arguments;
        if (!codes || codes.length === 0) {
            throw new Error("No book codes provided for bulk delete.");
        }
        const stateMachineArn = process.env.STATE_MACHINE_ARN;
        if (!stateMachineArn) {
            throw new Error("State machine ARN not defined in environment.");
        }
        // Iniciamos la ejecución
        const params = {
            stateMachineArn,
            input: JSON.stringify({ codes })
        };
        const startExecution = await stepFunctions.startExecution(params).promise();
        // Retornamos un executionArn para que se pueda monitorear
        return {
            executionArn: startExecution.executionArn,
            message: "Bulk delete for Books started."
        };
    }
    catch (error) {
        console.error("Error in bulkDeleteLambda:", error);
        throw error;
    }
};
exports.handler = handler;
