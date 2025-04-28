from langchain_core.tools import tool


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