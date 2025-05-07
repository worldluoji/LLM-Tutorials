from langchain_core.tools import tool
from langchain_qdrant import QdrantVectorStore
from fastembed import TextEmbedding
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

from llm import DeepSeek2

'''
将实体类的代码直接写死放到了工具函数中。
其实这样做也不是特别合适，因为如果实体类特别的多，则这个函数就会很长。
'''
@tool
def modelsTool(model_name: str):
    """该工具仅当用于生成实体类代码时才使用，否则请自行回答"""

    model_name = model_name.lower()

    if "user" or "用户" in model_name:
        return """
        class UserModel {
            UserID: number;
            UserName: string;
            UserEmail: string;

            constructor(UserID: number, UserName: string, UserEmail: string) {
                this.UserID = UserID;
                this.UserName = UserName;
                this.UserEmail = UserEmail;
            }
        }      
        """
    return ""


embeddings = TextEmbedding(model_name="snowflake/snowflake-arctic-embed-s")
def QdrantVecStore(collection_name:str):
    eb=embeddings
    return  QdrantVectorStore.\
        from_existing_collection(embedding=eb,
         url="http://127.0.0.1:6333",
          collection_name=collection_name)

def clearstr(s):
    filter_chars = ['\n', '\r', '\t', '\u3000','  ']
    for char in filter_chars:
        s=s.replace(char,'')
    return s

def format_docs(docs):
    return "\n\n".join(clearstr(doc.page_content) for doc in docs)

def qdrant_search(query:str):
    vec_store=QdrantVecStore(collection_name="model_data")
    prompt="""
    SYSTEM
    你是一个 typescript 语言编程专家，擅长根据问题生成模型实体类代码。
    使用上下文来创建实体class。你只需输出代码，无需任何解释和说明。一定不要将代码放到 ```typescript ``` 中。

    上下文：
    {context}

    模型名称例子：UserModel

    HUMAN
    模型或数据表信息：{question}
    """

    # k=5 意思是取前 5 条高于相似度阈值的结果
    retriver=vec_store.as_retriever(search_kwargs={"k":5})
    llm=DeepSeek2()
    prompt=ChatPromptTemplate.from_template(prompt)
    chain = {"context": retriver | format_docs,
             "question": RunnablePassthrough()} | prompt | llm | StrOutputParser()
    ret=chain.invoke(query)
    return ret

@tool
def modelsTool2(model_name: str):
    """该工具可用于生成实体类代码"""

    return qdrant_search(model_name)

