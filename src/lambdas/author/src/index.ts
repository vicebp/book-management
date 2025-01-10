import { DynamoDB } from 'aws-sdk';

const dynamo = new DynamoDB.DocumentClient();

interface Book {
    code: string;
    title: string;
    editionDate: string;
    authorRut: string;
    genres?: string[];
}

interface Author {
    rut: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    books?: Book[];
}

interface CreateAuthorInput {
    rut: string;
    firstName: string;
    lastName: string;
    birthDate: string;
}

interface UpdateAuthorInput {
    rut: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
}

interface DeleteAuthorInput {
    rut: string;
}


exports.handler = async (event: any): Promise<any> => {
    const operation: string = event.field;
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
    } catch (error) {
        console.error(`Error in ${operation}:`, error);
        throw new Error(`Could not complete the operation: ${operation}`);
    }
};

const createAuthor = async (input: CreateAuthorInput): Promise<Author> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Item: {
            ...input
        }
    };
    await dynamo.put(params).promise();
    return params.Item as Author;
};

const getAuthor = async (rut: string): Promise<Author | undefined> => {

    const paramsAuthor = {
        TableName: process.env.TABLE_NAME!,
        Key: { rut }
    };
    const resultAuthor = await dynamo.get(paramsAuthor).promise();
    const author = resultAuthor.Item as Author | undefined;

    if (!author) {
        return undefined;
    }

    const paramsBooks = {
        TableName: process.env.BOOK_TABLE_NAME!,
        IndexName: 'byAuthor',
        KeyConditionExpression: 'authorRut = :val',
        ExpressionAttributeValues: {
            ':val': rut
        }
    };
    const resultBooks = await dynamo.query(paramsBooks).promise();
    const books = resultBooks.Items ?? [];
    author.books = books as Book[];

    return author;
};

const listAuthors = async (): Promise<Author[]> => {
    const params = {
        TableName: process.env.TABLE_NAME!
    };
    const result = await dynamo.scan(params).promise();
    return result.Items as Author[];
};

const updateAuthor = async (input: UpdateAuthorInput): Promise<Author> => {
    const { rut, ...attributes } = input;
    const { updateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpressions(attributes);

    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { rut },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamo.update(params).promise();
    return result.Attributes as Author;
};

const deleteAuthor = async (input: DeleteAuthorInput): Promise<Author | undefined> => {
    const params = {
        TableName: process.env.TABLE_NAME!,
        Key: { rut: input.rut }, // Asegúrate de que `rut` sea una cadena
        ReturnValues: 'ALL_OLD'
    };

    try {
        const result = await dynamo.delete(params).promise();
        console.log("Eliminación exitosa:", result);
        return result.Attributes as Author | undefined;
    } catch (error) {
        console.error("Error en deleteAuthor:", error);
        throw error;
    }
};


const buildUpdateExpressions = (attributes: Partial<Author>) => {
    const updateExpressions: string[] = [];
    const ExpressionAttributeNames: Record<string, string> = {};
    const ExpressionAttributeValues: Record<string, any> = {};

    for (const key of Object.keys(attributes) as (keyof Author)[]) {
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