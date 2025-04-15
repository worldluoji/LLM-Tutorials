# 使用阿里提供的API生成图像示例
需要在.env文件中添加你在阿里云百炼上创建的 api key, 再执行：
```shell
npm install
npm run dev
```

参考： https://bailian.console.aliyun.com/console?tab=api#/api/?type=model&url=https%3A%2F%2Fhelp.aliyun.com%2Fdocument_detail%2F2862677.html

返回报文结构参考
```json
{
    "request_id": "ecd4f447-8b07-9fa8-82d9-f50811f2dd90",
    "output": {
        "task_id": "c7299bde-dac5-44d3-9b1f-8cb6e67c3e3d",
        "task_status": "SUCCEEDED",
        "submit_time": "2025-04-15 14:09:14.517",
        "scheduled_time": "2025-04-15 14:09:14.545",
        "end_time": "2025-04-15 14:09:23.434",
        "results": [
            {
                "orig_prompt": "A lovely tiger with a lovely rabbit",
                "actual_prompt": "温馨可爱的动物插画，一只威武的老虎与一只萌趣的小兔子正在互动。老虎拥有橙黑相间的毛发，眼神温和，嘴角带着微笑。小兔子全身雪白，长耳朵轻轻竖起，红色的眼睛充满好奇。它们站在一片开满野花的草地上，背景是蓝天白云和远处连绵的青山。画面采用柔和的水彩风格，色彩明亮清新，充满童话般的温暖氛围。近景对称构图，突出两只动物的和谐友爱。",
                "url": "https://dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com/1d/33/20250415/8928fb36/c7299bde-dac5-44d3-9b1f-8cb6e67c3e3d881017700.png?Expires=1744783762&OSSAccessKeyId=LTAI5tKPD3TMqf2Lna1fASuh&Signature=x6t7HouB8EzcbtOMqso7%2BDRn1Ps%3D"
            }
        ],
        "task_metrics": {
            "TOTAL": 1,
            "SUCCEEDED": 1,
            "FAILED": 0
        }
    },
    "usage": {
        "image_count": 1
    }
}
```