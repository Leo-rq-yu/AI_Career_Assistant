import json
from http import HTTPStatus
import dashscope
import time
dashscope.api_key='sk-3c43423c9fee4af8928fd8bc647291ee'
import re
from pymongo import MongoClient
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
MONGODB_URL = "mongodb+srv://leoyuruiqing:WziECEdgjZT08Xyj@airesume.niop3nd.mongodb.net/?retryWrites=true&w=majority&appName=AIResume"
DB_NAME = "airesumedb"
COLLECTION_NAME = "resumeChats"
COLLECTION_NAME_1 = "improvedUsers"
client = MongoClient(MONGODB_URL)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]
collection_1 = db[COLLECTION_NAME_1]

priority = {
    "基础信息": {
        "简历标题": "简历标题",
        "姓名": "姓名",
        "手机号码": "手机号码",
        "邮箱": "邮箱"
    },
    "教育经历": {
        "学历": "学历",
        "学校名称": "学校名称",
        "起止时间": "起止时间",
        "院系": "院系",
        "专业": "专业"
    },
    "职业经历": {
        "公司名称": "公司名称",
        "城市": "城市",
        "起止时间": "起止时间",
        "职位": "职位",
        "职责": "职责"
    },
    "项目经历": {
        "项目名称": "项目名称",
        "城市": "城市",
        "起止时间": "起止时间",
        "角色": "角色",
        "项目成就": "项目成就",
        "项目描述": "项目描述",
        "项目职责": "项目职责"
    },
    "获奖与证书": {
        "奖项名称": "奖项名称",
        "获奖时间": "获奖时间",
        "颁奖机构": "颁奖机构",
        "证书名称": "证书名称",
        "颁发机构": "颁发机构",
        "取得时间": "取得时间"
    },
    "科研论文与知识产权": {
        "论文标题": "论文标题",
        "作者排序": "作者排序",
        "期刊/会议": "期刊/会议",
        "出版时间": "出版时间",
        "专利名称": "专利名称",
        "专利号": "专利号",
        "申请/授权日期": "申请/授权日期"
    },
    "技能": {
        "技能名称": "技能名称",
        "熟练度": "熟练度"
    },
    "语言": {
        "语言": "语言",
        "熟练度": "熟练度"
    }
}

chatId = sys.argv[1]
resumeId = sys.argv[2]
#需要判断是哪一个section
section_id= sys.argv[3]


#chatId = 'a4e6762c-b26d-4619-92dd-2bd660adae5f'
#resumeId = 'a4e6762c-b26d-4619-92dd-2bd660adae5f'
#section_id = 1


keys_list = list(priority.keys())
initial_question_list = [
    "您能提供一下您的基本信息吗？包括姓名、联系电话、电子邮件和微信号。",
    "您可以按照学历从高到低列举一下您的教育背景吗？包括就读的学校、专业、学历和学习时间段。",
    "您有过哪些实习或工作的经历？如果有，请按照时间顺序提供公司名称、城市、职位、部门、起止时间以及主要职责。",
    "您参与过哪些重要的项目？如果有，请按照时间顺序描述项目名称、城市、您的角色、起止时间、项目描述、成就和主要职责。",
    "您获得过哪些奖项？如果有，请按照时间顺序列出名称、颁发机构、获奖级别、获奖名次、获得时间和简要描述。",
    "您获得过哪些证书？如果有，请按照时间顺序列出名称、颁发机构、获得时间和简要描述。",
    "您发表过哪些论文？如果有，请按照时间顺序提供论文题目、作者顺序、期刊名称、出版时间、研究描述和个人贡献。",
    "您取得过哪些知识产权？如果有，请按照时间顺序提供专利名称、专利号、发表或申请时间和简要描述。",
    "您掌握哪些专业技能？请列出您熟悉的软件、工具或技术，以及相应的熟练程度。",
    "请告诉我您掌握的所有语言以及对每种语言的熟练程度，可以用以下等级划分：普通、流利、高级、母语。如果您有相关语言考试的得分，也请提供。",
    "您可以简要描述一下自己的个人评价吗？包括您的优势、工作态度和职业目标等。"
]


def get_chat_from_mongodb(chat_id, resume_id):
    # 假设你已经知道如何定位到特定用户的聊天记录，这里用一个示例查询

    # 查询特定用户的聊天记录
    chat_record = collection.find_one({"_id": chat_id})
    user_record = collection_1.find_one({"_id": resume_id})

    chat_messages = chat_record['messages']

    standard_json = user_record['personal_data']

    # 获取最后一条消息. 格式是mock_qa.json里的格式
    last_message = chat_messages[-1]
    print(last_message)

    return last_message, standard_json


def check_if_initial(json_data, section_id):
    dict_data = json.loads(json_data)
    section_data = dict_data[dict_data.keys()[section_id]]
    if isinstance(section_data, dict):
        if all(value == "" for value in section_data.values()):
            return True
        return False
    elif isinstance(section_data, list):
        for item in section_data:
            if all(value == "" for value in item.values()):
                return True
        return False

def ask_new_question(updated_json, priority_json, section_id):
    prompt = f"你是一个面试官，现在我给你一个字典，是一个求职者的部分个人信息文档。里面有一些键的值是空的。"
    prompt += f'这一部分的主题是{keys_list[section_id]}。'
    prompt += f"我还有一个优先级列表，包含了这一部分里所需必填项的信息。"
    prompt += f"请你从头开始遍历优先级列表，并查看json中对应的值是否是空值。找到第一个对应值为空的键，然后提出一个针对性的问题，让求职者填写这个空缺值。"
    prompt += f"你只需要返回问题本身，不需要任何其他内容，比如解释。"
    prompt += f"以下是json文件内容：{updated_json}"
    prompt += f"以下是优先级顺序：{priority_json[priority_json.keys()[section_id]]}"

    response = dashscope.Generation.call(
        model=dashscope.Generation.Models.qwen_max,
        prompt= prompt,
        seed = 1234,
        top_p = 0.2,
        result_format = 'text',
        enable_search = False,
        max_tokens = 2000,
        temperature = 0.1,
        repetition_penalty = 1.0
    )

    if response.status_code == HTTPStatus.OK:
        print(response.usage)  # The usage information
        return response.output['text']  # The output text
    else:
        print(response.code)  # The error code.
        print(response.message)  # The error message.


def process_asking(json_data, section_id):
    bool_check = check_if_initial(json_data, section_id)
    if bool_check:
        return initial_question_list[section_id]
    else:
        # not the initial question, get the json chat data from json
        relevant_section = json_data[json_data.keys()[section_id]]
        new_question = ask_new_question(relevant_section, priority[keys_list[section_id]], section_id)
        return new_question




def update_json(original_json, last_chat, section_id):
    prompt = f"我有一段对话和一个有一部分填空的json文件。请你判断这段对话中包含的信息能填入json文件的哪里,然后更新这个json。你需要返回一个完整的json文件。以下是对话内容：{last_chat}"
    prompt += f"以下是json文件内容：{original_json[original_json.keys()[section_id]]}"

    response = dashscope.Generation.call(
        model=dashscope.Generation.Models.qwen_max,
        prompt= prompt,
        seed = 1234,
        top_p = 0.2,
        result_format = 'text',
        enable_search = False,
        max_tokens = 2000,
        temperature = 0.1,
        repetition_penalty = 1.0
    )

    if response.status_code == HTTPStatus.OK:
        # print(response.usage)  # The usage information
        print(response.output['text'])
        return response.output['text']  # The output text
    else:
        print(response.code)  # The error code.
        print(response.message)  # The error message.

def extract_json(data_str):
    # 使用正则表达式找到最外层的大括号
    matches = re.search(r'{.*}', data_str, re.S)
    if matches:
        json_str = matches.group(0)
        # print(json_str)
        try:
            # 尝试解析 JSON，确保它是有效的
            json_data = json.loads(json_str)
            return json_data
        except json.JSONDecodeError:
            print("找到的字符串不是有效的 JSON。")
            return None
    else:
        print("没有找到符合 JSON 格式的内容。")
        return None

def update_mongodb(chat_id, new_question, resume_id, updated_json):

    chat_record = collection.find_one({"_id": chat_id})
    resume_record = collection_1.find_one({"_id": resume_id})

    if chat_record:
        # Get the current length of the messages array
        messages_length = len(chat_record.get('messages', []))

        # Create the new message with id and question
        new_message = {"id": messages_length + 1, "question": new_question}

        # Add the new message to the messages array
        collection.update_one(
            {"_id": chat_id},
            {"$push": {"messages": new_message}}
        )

        print(json.dumps({"status": "success", "id": messages_length + 1, "message": new_message}))
    else:
        print(json.dumps({"status": "error", "message": "Chat record not found"}))
        
    if resume_record:
        collection_1.update_one(
            {"_id": resume_id},
            {"$set": {"personal_data": updated_json}}
        )
        print(json.dumps({"status": "success", "message": "Resume record updated"}))
    else:
        print(json.dumps({"status": "error", "message": "Resume record not found"}))


        
def close_mongodb():
    client.close()

last_message, standard_json = get_chat_from_mongodb(chatId, resumeId)
json_update = update_json(standard_json, last_message, section_id)
json_update = re.sub(r"```json",'',json_update)
json_update = re.sub(r"```",'',json_update)
# json_update dtype: str
# 只保留str最外层的两个{}之内的内容，删除其他内容
json_update = extract_json(json_update)
new_query = process_asking(json_update, section_id)
update_mongodb(chatId, new_query, resumeId, json_update)
close_mongodb()
print(new_query)

