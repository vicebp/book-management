"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dynamo = new aws_sdk_1.default.DynamoDB.DocumentClient();
const handler = async (event) => {
    const code = typeof event === "string" ? event : event.code;
    try {
        const book = await getBook(code);
        if (!book) {
            console.log(`Book ${code} not found, skipping`);
            return { success: true, message: `Book ${code} not found, skipping.` };
        }
        if (book.authorRut) {
            await removeBookReferenceFromAuthor(book.authorRut, code);
        }
        await deleteBook(code);
        return { success: true, message: `Book ${code} deleted with cascade.` };
    }
    catch (error) {
        console.error("Error in deleteBookCascadeLambda:", error);
        throw error;
    }
};
exports.handler = handler;
async function getBook(code) {
    const params = {
        TableName: process.env.BOOK_TABLE_NAME,
        Key: { code }
    };
    const result = await dynamo.get(params).promise();
    return result.Item;
}
async function deleteBook(code) {
    const params = {
        TableName: process.env.BOOK_TABLE_NAME,
        Key: { code },
    };
    await dynamo.delete(params).promise();
    console.log(`Book ${code} removed from DB`);
}
async function removeBookReferenceFromAuthor(authorRut, code) {
    try {
        // 1) obtener autor (opcional, si necesitas).
        const authorParams = {
            TableName: process.env.AUTHOR_TABLE_NAME,
            Key: { rut: authorRut }
        };
        const authorResult = await dynamo.get(authorParams).promise();
        if (!authorResult.Item) {
            console.log(`Author ${authorRut} not found, skipping reference removal`);
            return;
        }
        // Supongamos que el Author tiene un array "books" 
        // con el "code" de cada libro:
        const author = authorResult.Item;
        if (!author.books || !author.books.includes(code)) {
            console.log(`Author ${authorRut} doesn't reference book ${code}, skipping`);
            return;
        }
        // 2) Filtrar el libro a eliminar
        const updatedBooks = author.books.filter((c) => c !== code);
        // 3) Actualizar el Author
        const updateParams = {
            TableName: process.env.AUTHOR_TABLE_NAME,
            Key: { rut: authorRut },
            UpdateExpression: 'SET #books = :books',
            ExpressionAttributeNames: {
                '#books': 'books'
            },
            ExpressionAttributeValues: {
                ':books': updatedBooks
            }
        };
        await dynamo.update(updateParams).promise();
        console.log(`Removed book ${code} from author ${authorRut}`);
    }
    catch (error) {
        console.error("Error removing book reference from author:", error);
        throw error;
    }
}
