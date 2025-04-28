# coding with LLM
示例1演示了使用LangGraph + 大模型生成代码。生成了一个 fasitify 的简单服务和路由处理。
```
uv run gen-fatify-code.py
```
![生成思路](./assets/gen-fastify-code思路.png)

---

示例2演示了web后端代码的生成思路。
```
uv run gen-backend-code.py
```
![生成思路](./assets/gen-backend-code思路.png)

这样，prompt里加入了实体类的描述，如果实体类特别多，prompt就会特别长。

---

示例3做了改进，使用了agent(即model_tools)生成实体类。
```
uv run gen-backend-code2.py
```
但是这样同样存在问题。如果实体类特别多，agent里的代码也会特别长。

---

最好的做法是，我们提前设计好数据字典文档，之后由大模型根据数据字典文档来生成实体类。

一般会将用户表和商品表写成一个 Word 或者 Excel文档，便于在团队内传阅。
当我对大模型说“创建用户实体模型”时，大模型会读取文档中的用户表的内容，然后生成代码。如何能实现这个效果呢？那就是 RAG。

首先还是将文档转向量，塞入向量数据库:
```python
def QdrantVecStoreFromDocs(docs:List[Document]):
    eb=TongyiEmbedding()
    return QdrantVectorStore.from_documents(docs,eb,url="http://<你的qdrant地址>:6333",collection_name="data")

def load_doc():
    #nltk.download('punkt_tab')
    #nltk.download('averaged_perceptron_tagger')
    word=UnstructuredWordDocumentLoader('数据字典.docx')
    docs=word.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=50,
                                              chunk_overlap=20)
    s_docs=splitter.split_documents(docs)
    QdrantVecStoreFromDocs(s_docs)
```
将 Word 文档读取后，按照 50 字符分块，20 字符重复的方式来切分文档。之后调用 QdrantVecStoreFromDocs 方法，将分块后的文本转成向量，塞入到向量数据库。


之后就是对 Agent tool 的改造。前面的 Agent tool 是根据用户传入的关键字匹配相应的实体类代码段，现在要改成根据用户传入的关键字，从向量数据库中匹配到相应的数据字典，然后让大模型根据数据字典的内容生成实体类代码。因此代码要这么写：
```python
def QdrantVecStore(collection_name:str):
    eb=TongyiEmbedding()
    return  QdrantVectorStore.\
        from_existing_collection(embedding=eb,
         url="http://<你的Qdrant地址>:6333",
          collection_name=collection_name)

def clearstr(s):
    filter_chars = ['\n', '\r', '\t', '\u3000','  ']
    for char in filter_chars:
        s=s.replace(char,'')
    return s

def format_docs(docs):
    return "\n\n".join(clearstr(doc.page_content) for doc in docs)

def qdrant_search(query:str):
    vec_store=QdrantVecStore(collection_name="data")
    prompt="""
    SYSTEM
    你是一个 typescript 语言编程专家，擅长根据问题生成模型实体类代码。
    使用上下文来创建实体class。你只需输出typescript代码，无需任何解释和说明。不要将代码放到 ```typescript ``` 中。

    上下文：
    {context}

    模型名称例子：UserModel

    HUMAN
    模型或数据表信息：{question}
    """

    retriver=vec_store.as_retriever(search_kwargs={"k":5})
    llm=DeepSeek()
    prompt=ChatPromptTemplate.from_template(prompt)
    chain = {"context": retriver | format_docs,
             "question": RunnablePassthrough()} | prompt | llm | StrOutputParser()
    ret=chain.invoke(query)
    return ret

@tool
def modelsTool(model_name: str):
    """该工具可用于生成实体类代码"""

    return qdrant_search(model_name)
```