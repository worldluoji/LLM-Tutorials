from typing import List
from docx import Document
from langchain_community.document_loaders import UnstructuredWordDocumentLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from langchain_qdrant import QdrantVectorStore
from fastembed import TextEmbedding

import nltk

# 初始化 FastEmbed
embeddings = TextEmbedding(model_name="snowflake/snowflake-arctic-embed-s")

def QdrantVecStoreFromDocs(docs:List[Document]):
    eb=embeddings
    return QdrantVectorStore.from_documents(docs,eb,url="http://127.0.0.1:6333",collection_name="model_data")

def load_doc():
    nltk.download('punkt_tab')
    nltk.download('averaged_perceptron_tagger')
    word=UnstructuredWordDocumentLoader('/Users/luke-surface-mac/code/AI-Drawing-Tutorials/application/coding-demo/data/数据字典.docx')
    docs=word.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=50,
                                              chunk_overlap=20)
    s_docs=splitter.split_documents(docs)
    QdrantVecStoreFromDocs(s_docs)


if __name__ == '__main__':
    load_doc()