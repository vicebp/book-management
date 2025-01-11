"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = require("aws-sdk");
const dynamo = new aws_sdk_1.DynamoDB.DocumentClient();
exports.handler = async (event) => {
    const operation = event.field;
    const args = event.arguments;
    try {
        switch (operation) {
            case 'createAuthor':
                return await createAuthor(args.input);
            case 'getAuthor':
                return await getAuthor(args.rut);
            case 'listAuthors':
                return await listAuthors();
            case 'updateAuthor':
                return await updateAuthor(args.input);
            case 'deleteAuthor':
                return await deleteAuthor(args.input);
            default:
                throw new Error(`Operation not supported: ${operation}`);
        }
    }
    catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};
const createAuthor = async (input) => {
    const params = {
        TableName: process.env.TABLE_NAME,
        Item: {
            ...input
        }
    };
    await dynamo.put(params).promise();
    return params.Item;
};
const getAuthor = async (rut) => {
    var _a;
    const paramsAuthor = {
        TableName: process.env.TABLE_NAME,
        Key: { rut }
    };
    const resultAuthor = await dynamo.get(paramsAuthor).promise();
    const author = resultAuthor.Item;
    if (!author) {
        return undefined;
    }
    const paramsBooks = {
        TableName: process.env.BOOK_TABLE_NAME,
        IndexName: 'byAuthor',
        KeyConditionExpression: 'authorRut = :val',
        ExpressionAttributeValues: {
            ':val': rut
        }
    };
    const resultBooks = await dynamo.query(paramsBooks).promise();
    const books = (_a = resultBooks.Items) !== null && _a !== void 0 ? _a : [];
    author.books = books;
    return author;
};
const listAuthors = async () => {
    const params = {
        TableName: process.env.TABLE_NAME
    };
    const result = await dynamo.scan(params).promise();
    return result.Items;
};
const updateAuthor = async (input) => {
    const { rut, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { rut },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };
    const result = await dynamo.update(params).promise();
    return result.Attributes;
};
const deleteAuthor = async (input) => {
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { rut: input.rut }, // Asegúrate de que `rut` sea una cadena
        ReturnValues: 'ALL_OLD'
    };
    try {
        const result = await dynamo.delete(params).promise();
        console.log("Eliminación exitosa:", result);
        return result.Attributes;
    }
    catch (error) {
        console.error("Error en deleteAuthor:", error);
        throw error;
    }
};
const buildUpdateExpressions = (attributes) => {
    const updateExpressions = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    for (const key of Object.keys(attributes)) {
        if (attributes[key] !== undefined) {
            updateExpressions.push(`#${key} = :${key}`);
            ExpressionAttributeNames[`#${key}`] = key;
            ExpressionAttributeValues[`:${key}`] = attributes[key];
        }
    }
    return {
        updateExpression: 'SET ' + updateExpressions.join(', '),
        ExpressionAttributeNames,
        ExpressionAttributeValues
    };
};
