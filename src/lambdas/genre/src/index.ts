import { DynamoDB } from 'aws-sdk';

const dynamo = new DynamoDB.DocumentClient();

interface Book {
    code: string;
    title: string;
    editionDate: string;
    authorRut: string;
    genres?: Genre[];
}

interface Genre {
    id: string;
    name: string;
    books?: string[];
}

interface CreateGenreInput {
    id: string;
    name: string;
}

interface UpdateGenreInput {
    id: string;
    name?: string;
}

interface DeleteGenreInput {
    id: string;
}

exports.handler = async (event: any): Promise<any> => {
    const operation: string = event.field;
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
    } catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};

const createGenre = async (input: CreateGenreInput): Promise<Genre> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Item: input,
    };
    await dynamo.put(params).promise();
    return params.Item as Genre;
};

const getGenre = async (id: string): Promise<Genre | undefined> => {
    // 1. Obtener el género de la tabla "Genres"
    const params = {
        TableName: process.env.TABLE_NAME!, // Nombre de la tabla de géneros
        Key: { id },
    };
    const result = await dynamo.get(params).promise();
    const genre = result.Item as Genre | undefined;

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
                [process.env.BOOK_TABLE_NAME!]: {
                    Keys: bookKeys
                }
            }
        };

        const batchResult = await dynamo.batchGet(batchParams).promise();
        const booksFound = batchResult.Responses?.[process.env.BOOK_TABLE_NAME!] || [];

        // 4. Sobrescribes "genre.books" con los objetos completos
        genre.books = booksFound as string[] & Book[];
        //   Lo correcto sería cambiar la interfaz a `books?: Book[];` o usar otra propiedad para los datos completos.
    }

    return genre;
};


const listGenres = async (): Promise<Genre[]> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
    };
    const result = await dynamo.scan(params).promise();
    return result.Items as Genre[];
};

const updateGenre = async (input: UpdateGenreInput): Promise<Genre> => {
    const { id, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);

    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    };

    const result = await dynamo.update(params).promise();
    return result.Attributes as Genre;
};

const deleteGenre = async (input: DeleteGenreInput): Promise<Genre | undefined> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { id: input.id },
        ReturnValues: 'ALL_OLD',
    };
    const result = await dynamo.delete(params).promise();
    return result.Attributes as Genre | undefined;
};

const buildUpdateExpressions = (attributes: Partial<Genre>) => {
    const updateExpressions: string[] = [];
    const ExpressionAttributeNames: Record<string, string> = {};
    const ExpressionAttributeValues: Record<string, any> = {};

    for (const key of Object.keys(attributes) as (keyof Genre)[]) {
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

