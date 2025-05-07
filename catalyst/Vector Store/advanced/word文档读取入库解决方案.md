# word文档读取入库解决方案
代码的流程是这样的。首先将 word 文档加载、切片，然后转成向量塞入向量数据库。之后，当用户提问问题时，先将用户的问题转成向量，在向量数据库中匹配。匹配到合适的片段后，将片段与用户问题一起喂给大模型，由大模型给出最终的回复。

---

## word 文档加载
### 方案一：读取全部的word文档内容
[代码](../../Agent/jobsearch-mcp-server/src/jobsearch_mcp_server/word/word.py)

实际就是使用python-docx库读取word文档。

---

### 方案二：使用langchain
```python
# pip install python-docx
from langchain_community.document_loaders import UnstructuredWordDocumentLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
import nltk

def load_doc():
    #nltk.download('punkt_tab')
    #nltk.download('averaged_perceptron_tagger')

    word=UnstructuredWordDocumentLoader('E:\\AI\\个人简历.docx')
    docs=word.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=50,
                                              chunk_overlap=20, )
    s_docs=splitter.split_documents(docs)
```
代码使用了 UnstructuredWordDocumentLoader 读取了简历，然后使用 RecursiveCharacterTextSplitter 设置拆分粒度。这里有两个值，一个是 chunk_size，表示按多大的字符数进行拆分，chunk_overlap 则表示覆盖粒度。比如，有一个文档的内容是 123456，如果将 chunk_size 设置为 2，则就按 12 34 56 进行拆分，但如果设置了 chunk_overlap 为 1，就会变成 12 23 34 45 56。

这里还需要注意一点的是，由于 UnstructuredWordDocumentLoader 底层使用了一个用来做语义理解的 nltk 库，这个库在代码第一次执行时，需要下载两个文件。因此前面代码里，我注释了第 7、8 两行。如果是首次运行代码，需要打开。

---

## 将文档转成向量塞入向量数据库
```python
def TongyiEmbedding()->DashScopeEmbeddings:
    api_key=os.environ.get("dashscope")
    return DashScopeEmbeddings(dashscope_api_key=api_key,
                           model="text-embedding-v1")

def QdrantVecStoreFromDocs(docs:List[Document]):
    eb=TongyiEmbedding()
    return QdrantVectorStore.from_documents(docs,eb,url="http://<你的公网IP>:6333")

vec_store=QdrantVecStoreFromDocs(s_docs)
```
上面使用了通义千问的向量模型 text-embedding-v1，也可以使用其他[本地模型](./TextEmbedding.md)。