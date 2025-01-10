"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = require("aws-sdk");
const dynamo = new aws_sdk_1.DynamoDB.DocumentClient();
exports.handler = async (event) => {
    const operation = event.field;
    const args = event.arguments;
    try {
        switch (operation) {
            case 'createBook':
                return await createBook(args.input);
            case 'getBook':
                return await getBook(args.code);
            case 'listBooks':
                return await listBooks();
            case 'updateBook':
                return await updateBook(args.input);
            case 'deleteBook':
                return await deleteBook(args.input);
            default:
                throw new Error(`Operation not supported: ${operation}`);
        }
    }
    catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};
const createBook = async (input) => {
    var _a, _b, _c;
    if (input.genres && input.genres.length > 0) {
        const keys = input.genres.map((genreId) => ({ id: genreId }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME]: { Keys: keys },
            },
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        const foundGenres = ((_a = batchResult.Responses) === null || _a === void 0 ? void 0 : _a[process.env.GENRE_TABLE_NAME]) || [];
        if (foundGenres.length !== input.genres.length) {
            throw new Error("Error: Uno o más IDs de género no existen en la tabla 'Genres'.");
        }
    }
    const putParams = {
        TableName: process.env.TABLE_NAME,
        Item: {
            ...input,
        },
    };
    await dynamo.put(putParams).promise();
    let foundGenres = [];
    if (input.genres && input.genres.length > 0) {
        const keys = input.genres.map((genreId) => ({ id: genreId }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME]: { Keys: keys },
            },
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        foundGenres = ((_c = (_b = batchResult.Responses) === null || _b === void 0 ? void 0 : _b[process.env.GENRE_TABLE_NAME]) !== null && _c !== void 0 ? _c : []);
    }
    const bookWithGenres = {
        ...putParams.Item,
        genres: foundGenres,
    };
    return bookWithGenres;
};
const getBook = async (code) => {
    var _a;
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { code }
    };
    const result = await dynamo.get(params).promise();
    const book = result.Item;
    if (!book) {
        return undefined;
    }
    if (book.genres && book.genres.length > 0) {
        const genreKeys = book.genres.map((genre) => ({ id: genre }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME]: {
                    Keys: genreKeys
                }
            }
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        const genresData = ((_a = batchResult.Responses) === null || _a === void 0 ? void 0 : _a[process.env.GENRE_TABLE_NAME]) || [];
        book.genres = genresData;
    }
    return book;
};
const listBooks = async () => {
    const params = {
        TableName: process.env.TABLE_NAME
    };
    const result = await dynamo.scan(params).promise();
    return result.Items;
};
const updateBook = async (input) => {
    const { code, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { code },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };
    const result = await dynamo.update(params).promise();
    return result.Attributes;
};
const deleteBook = async (input) => {
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { code: input.code },
        ReturnValues: 'ALL_OLD'
    };
    try {
        const result = await dynamo.delete(params).promise();
        return result.Attributes;
    }
    catch (error) {
        console.error("Error in deleteBook:", error);
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
