import dotenv from "dotenv";
import { DataAPIClient } from "@datastax/astra-db-ts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import OpenAI from "openai";
import sampleData from "./sample_data.json";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
if (!process.env.ASTRA_DB_APPLICATION_TOKEN) {
  throw new Error("ASTRA_DB_APPLICATION_TOKEN is not defined");
}

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT, {
  namespace: process.env.ASTRA_DB_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 200,
  chunkOverlap: 100,
});

const createCollection = async () => {
  try {
    const res = await db.createCollection("characters", {
      vector: {
        dimension: 1536,
      },
    });
    console.log(res);
  } catch (error) {
    console.log("Collection already exists");
  }
};

const loadSampleData = async () => {
  const collection = await db.collection("characters");
  for await (const { id, name, description } of sampleData) {
    const chunks = await splitter.splitText(description);
    let i = 0;
    for await (const chunk of chunks) {
      const { data } = await openai.embeddings.create({
        input: chunk,
        model: "text-embedding-ada-002",
      });

      const res = await collection.insertOne({
        docuemnt_id: id,
        $vector: data[0]?.embedding,
        name,
        description: chunk,
      });
      i++;
    }
  }
  console.log("data loaded");
};

createCollection().then(() => loadSampleData());
