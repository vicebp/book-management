import AWS from 'aws-sdk';
const dynamo = new AWS.DynamoDB.DocumentClient();

interface Book {
    code: string;
    title: string;
    editionDate: string;
    authorRut: string;
    genres?: string[];
}

export const handler = async (event: any) => {
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
    } catch (error) {
        console.error("Error in deleteBookCascadeLambda:", error);
        throw error;
    }
};

async function getBook(code: string): Promise<Book | undefined> {
    const params = {
        TableName: process.env.BOOK_TABLE_NAME!,
        Key: { code }
    };
    const result = await dynamo.get(params).promise();
    return result.Item as Book | undefined;
}

async function deleteBook(code: string) {
    const params = {
        TableName: process.env.BOOK_TABLE_NAME!,
        Key: { code },
    };
    await dynamo.delete(params).promise();
    console.log(`Book ${code} removed from DB`);
}

async function removeBookReferenceFromAuthor(authorRut: string, code: string) {
    try {
        // 1) obtener autor (opcional, si necesitas).
        const authorParams = {
            TableName: process.env.AUTHOR_TABLE_NAME!,
            Key: { rut: authorRut }
        };
        const authorResult = await dynamo.get(authorParams).promise();
        if (!authorResult.Item) {
            console.log(`Author ${authorRut} not found, skipping reference removal`);
            return;
        }

        // Supongamos que el Author tiene un array "books" 
        // con el "code" de cada libro:
        const author = authorResult.Item as { rut: string; books?: string[] };

        if (!author.books || !author.books.includes(code)) {
            console.log(`Author ${authorRut} doesn't reference book ${code}, skipping`);
            return;
        }

        // 2) Filtrar el libro a eliminar
        const updatedBooks = author.books.filter((c) => c !== code);

        // 3) Actualizar el Author
        const updateParams = {
            TableName: process.env.AUTHOR_TABLE_NAME!,
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
    } catch (error) {
        console.error("Error removing book reference from author:", error);
        throw error;
    }
}
