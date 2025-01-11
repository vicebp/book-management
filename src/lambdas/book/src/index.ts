import { DynamoDB } from 'aws-sdk';

const dynamo = new DynamoDB.DocumentClient();

interface GetBooksByAuthorInput {
    authorRut: string;
}

interface Genre {
    id: string;
    name: string;
    // Otros campos
}

interface Book {
    code: string;
    title: string;
    editionDate: string;
    authorRut: string;
    genres?: Genre[];
}

interface CreateBookInput {
    code: string;
    title: string;
    editionDate: string;
    authorRut: string;
    genres?: string[];
}

interface UpdateBookInput {
    code: string;
    title?: string;
    editionDate?: string;
    authorRut?: string;
}

interface DeleteBookInput {
    code: string;
}

exports.handler = async (event: any): Promise<any> => {
    const operation: string = event.field;
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
    } catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};

const createBook = async (input: CreateBookInput): Promise<Book> => {
    if (input.genres && input.genres.length > 0) {
        const keys = input.genres.map((genreId) => ({ id: genreId }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME!]: { Keys: keys },
            },
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        const foundGenres = batchResult.Responses?.[process.env.GENRE_TABLE_NAME!] || [];

        if (foundGenres.length !== input.genres.length) {
            throw new Error("Error: Uno o más IDs de género no existen en la tabla 'Genres'.");
        }
    }
    const putParams = {
        TableName: process.env.TABLE_NAME!,
        Item: {
            ...input,
        },
    };
    await dynamo.put(putParams).promise();

    let foundGenres: Genre[] = [];
    if (input.genres && input.genres.length > 0) {
        const keys = input.genres.map((genreId) => ({ id: genreId }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME!]: { Keys: keys },
            },
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        foundGenres = (batchResult.Responses?.[process.env.GENRE_TABLE_NAME!] ?? []) as Genre[];

    }

    const bookWithGenres: Book = {
        ...putParams.Item,
        genres: foundGenres,
    };

    return bookWithGenres;
};



const getBook = async (code: string): Promise<Book | undefined> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { code }
    };
    const result = await dynamo.get(params).promise();
    const book = result.Item as Book | undefined;
    if (!book) {
        return undefined;
    }

    if (book.genres && book.genres.length > 0) {
        const genreKeys = book.genres.map((genre) => ({ id: genre }));
        const batchParams = {
            RequestItems: {
                [process.env.GENRE_TABLE_NAME!]: {
                    Keys: genreKeys
                }
            }
        };
        const batchResult = await dynamo.batchGet(batchParams).promise();
        const genresData = batchResult.Responses?.[process.env.GENRE_TABLE_NAME!] || [];
        book.genres = genresData as Genre[];
    }
    return book;
};

const listBooks = async (): Promise<Book[]> => {
    const params = {
        TableName: process.env.TABLE_NAME!
    };
    const result = await dynamo.scan(params).promise();
    return result.Items as Book[];
};

const updateBook = async (input: UpdateBookInput): Promise<Book> => {
    const { code, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);

    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { code },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamo.update(params).promise();
    return result.Attributes as Book;
};

const deleteBook = async (input: DeleteBookInput): Promise<Book | undefined> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { code: input.code },
        ReturnValues: 'ALL_OLD'
    };

    try {
        const result = await dynamo.delete(params).promise();
        return result.Attributes as Book | undefined;
    } catch (error) {
        console.error("Error in deleteBook:", error);
        throw error;
    }
};

const buildUpdateExpressions = (attributes: Partial<Book>) => {
    const updateExpressions: string[] = [];
    const ExpressionAttributeNames: Record<string, string> = {};
    const ExpressionAttributeValues: Record<string, any> = {};

    for (const key of Object.keys(attributes) as (keyof Book)[]) {
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
