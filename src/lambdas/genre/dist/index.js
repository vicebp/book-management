"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = require("aws-sdk");
const dynamo = new aws_sdk_1.DynamoDB.DocumentClient();
exports.handler = async (event) => {
    const operation = event.field;
    const args = event.arguments;
    try {
        switch (operation) {
            case 'createGenre':
                return await createGenre(args.input);
            case 'getGenre':
                return await getGenre(args.id);
            case 'listGenres':
                return await listGenres();
            case 'updateGenre':
                return await updateGenre(args.input);
            case 'deleteGenre':
                return await deleteGenre(args.input);
            default:
                throw new Error(`Operation not supported: ${operation}`);
        }
    }
    catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};
const createGenre = async (input) => {
    const params = {
        TableName: process.env.TABLE_NAME,
        Item: input,
    };
    await dynamo.put(params).promise();
    return params.Item;
};
const getGenre = async (id) => {
    var _a;
    // 1. Obtener el género de la tabla "Genres"
    const params = {
        TableName: process.env.TABLE_NAME, // Nombre de la tabla de géneros
        Key: { id },
    };
    const result = await dynamo.get(params).promise();
    const genre = result.Item;
    if (!genre) {
        return undefined;
    }
    // 2. Verificar si tiene libros asociados (IDs)
    if (genre.books && genre.books.length > 0) {
        // 3. Por cada "bookId", obtener el libro desde la tabla "Book"
        //    Para muchos libros, podrías usar un batchGet;
        //    si es uno o pocos, podrías usar get en un loop.
        //    Ejemplo con batchGet (más eficiente que varios "get" independientes).
        const bookKeys = genre.books.map(bookId => ({ code: bookId }));
        const batchParams = {
            RequestItems: {
                [process.env.BOOK_TABLE_NAME]: {
                    Keys: bookKeys
                }
            }
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        const booksFound = ((_a = batchResult.Responses) === null || _a === void 0 ? void 0 : _a[process.env.BOOK_TABLE_NAME]) || [];
        // 4. Sobrescribes "genre.books" con los objetos completos
        genre.books = booksFound;
        //   Lo correcto sería cambiar la interfaz a `books?: Book[];` o usar otra propiedad para los datos completos.
    }
    return genre;
};
const listGenres = async () => {
    const params = {
        TableName: process.env.TABLE_NAME,
    };
    const result = await dynamo.scan(params).promise();
    return result.Items;
};
const updateGenre = async (input) => {
    const { id, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    };
    const result = await dynamo.update(params).promise();
    return result.Attributes;
};
const deleteGenre = async (input) => {
    const params = {
        TableName: process.env.TABLE_NAME,
        Key: { id: input.id },
        ReturnValues: 'ALL_OLD',
    };
    const result = await dynamo.delete(params).promise();
    return result.Attributes;
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
