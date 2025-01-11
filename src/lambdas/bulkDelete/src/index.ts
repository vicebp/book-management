import { Context } from 'aws-lambda';
import AWS from 'aws-sdk';

const stepFunctions = new AWS.StepFunctions();

export const handler = async (event: any, context: Context) => {
    try {
        // AppSync -> Lambda: event.arguments.codes (array de strings)
        const { codes } = event.arguments as { codes: string[] };
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

    } catch (error) {
        console.error("Error in bulkDeleteLambda:", error);
        throw error;
    }
};
