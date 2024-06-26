const express = require('express');
const router = express.Router();
const ImprovedUser = require('../mongodb/models/ImprovedUser.js'); // 确保路径与你的项目结构相匹配
const Account = require('../mongodb/models/Account'); // 引入Account模型
const { spawn } = require('child_process');
const ResumeHistory = require('../mongodb/models/ResumeHistory');

// 定义英文到中文的映射
const typeToChinese = {
    basicInformation: '基本信息',
    personalEvaluation: '个人评价',
    educationHistory: '教育经历',
    professionalExperience: '职业经历',
    projectExperience: '项目经历',
    awardsAndCertificates: '获奖与证书',
    skills: '技能',
    languages: '语言',
    researchPapersAndPatents: '科研论文与知识产权'
};
// 辅助函数：格式化日期为 YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0'); // 月份从0开始，所以需要加1
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

let processResult = {};

// 创建新的用户
router.post('/improved-users', async (req, res) => {
    try {
        // 从请求中获取Account的phoneNumber
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ message: 'Phone number is required to link account' });
        }

        const newUser = new ImprovedUser(
            req.body.基本信息,
            req.body.个人评价,
            req.body.教育经历,
            req.body.职业经历,
            req.body.项目经历,
            req.body.获奖与证书,
            req.body.语言,
            req.body.技能,
            req.body.科研论文与知识产权
        );
        const _id = newUser._id;  // 获取新的ImprovedUser的ID

        // 查找Account并添加ImprovedUser的ID
        const account = await Account.findByPhoneNumber(phoneNumber);
        if (account) {
            await Account.addImprovedUser(account._id, _id);

            // 创建空白的 ResumeHistory，格式化日期
            const defaultTitle = "Default Title";
            const createdAt = formatDate(new Date()); // 当前时间，格式化为 YYYY-MM-DD
            const newResumeHistory = new ResumeHistory(
                account._id,
                createdAt,
                defaultTitle,
                "", // position 为空
                "", // pdfData 为空
                ""  // markdownData 为空
            );
            const resumeHistoryId = await newResumeHistory.save(); // 保存ResumeHistory并获取其ID

            // 将 resumeHistoryId 关联到 ImprovedUser
            newUser.resumeId = resumeHistoryId;

            // 只需保存一次 ImprovedUser
            await newUser.save();

            // 调用 Python 文件更新完整度
            const pythonProcess = spawn('python3', ['./pyScripts/update_complete_score.py', _id]);

            pythonProcess.stdout.on('data', async (data) => {
                console.log(`stdout: ${data}`);

                // 解析 Python 文件的输出
                const output = JSON.parse(data.toString());
                const updatedCompleteness = output.completeness;

                // 更新数据库中的完整度字段
                await ImprovedUser.updateCompleteness(_id, updatedCompleteness);

                // 返回更新后的完整度
                res.status(201).json({ message: 'Improved user and resume history created successfully', _id: _id, resumeHistoryId: resumeHistoryId, completeness: updatedCompleteness });
            });

            pythonProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });

            pythonProcess.on('close', (code) => {
                console.log(`child process exited with code ${code}`);
            });

        } else {
            res.status(404).json({ message: 'Account not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to create improved user or update account', error: error.toString() });
    }
});



// 根据ID查询用户
router.get('/improved-users/:_id', async (req, res) => {
    try {
        const resumeRecord = await ImprovedUser.findById(req.params._id);
        if (!resumeRecord) {
            return res.status(404).json({ message: 'Resume record not found' });
        }

        // 调用 Python 文件更新完整度
        const pythonProcess = spawn('python3', ['./pyScripts/update_complete_score.py', resumeRecord._id]);
        
        pythonProcess.stdout.on('data', async (data) => {
            console.log(`stdout: ${data}`);
            
            // 解析 Python 文件的输出
            const output = JSON.parse(data.toString());
            const updatedCompleteness = output.completeness;

            // 更新数据库中的完整度字段
            await ImprovedUser.update(resumeRecord._id, { completeness: updatedCompleteness });
            
            // 返回更新后的完整度
            res.status(200).json({ ...resumeRecord, completeness: updatedCompleteness });
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve user', error: error.toString() });
    }
});


// 根据ID和类型查询用户的特定信息
router.get('/improved-users/:_id/:type', async (req, res) => {
    try {
        const { _id, type } = req.params;
        const chineseType = typeToChinese[type]; // 获得中文字段名
        if (!chineseType) {
            return res.status(400).json({ message: "Invalid type specified" });
        }

        const resumeRecord = await ImprovedUser.findById(_id);
        console.log(resumeRecord);
        if (resumeRecord) {
            try {
                const responseData = resumeRecord.personal_data[chineseType] || null; // 如果指定类型不存在，返回 null
                const updatedAt = resumeRecord.updatedAt;
                res.status(200).json({ data: responseData, _id: _id, updateTime: updatedAt });
            } catch (error) {
                console.error(error);
                res.status(200).json({ data: { title: "" }, _id: _id, updateTime: "" });
            }
        } else {
            res.status(404).json({ message: 'Resume record not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve user', error: error.toString() });
    }
});



// 更新用户信息
router.patch('/improved-users/:_id', async (req, res) => {
    try {
        const updateResult = await ImprovedUser.update(req.params._id, req.body);
        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ message: 'No user found to update' });
        }

        // 调用 Python 文件更新完整度
        const pythonProcess = spawn('python3', ['./pyScripts/update_complete_score.py', req.params._id]);

        pythonProcess.stdout.on('data', async (data) => {
            console.log(`stdout: ${data}`);

            // 解析 Python 文件的输出
            const output = JSON.parse(data.toString());
            const updatedCompleteness = output.completeness;

            // 更新数据库中的完整度字段
            await ImprovedUser.updateCompleteness(req.params._id, updatedCompleteness);

            // 返回更新后的完整度
            res.status(200).json({ message: 'User updated successfully', completeness: updatedCompleteness });
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update user', error: error.toString() });
    }
});

// 删除用户，并从账户的 improvedUsers 列表中删除其 ID
router.delete('/improved-users', async (req, res) => {
    const { phoneNumber, improvedUserId } = req.body;
    console.log(phoneNumber, improvedUserId);

    if (!phoneNumber || !improvedUserId) {
        return res.status(400).json({ message: 'Phone number and improvedUserId are required' });
    }

    try {
        // 查找对应的账户
        const account = await Account.findByPhoneNumber(phoneNumber);
        if (!account) {
            return res.status(404).json({ message: 'Account not found' });
        }
        console.log(account._id);
        // 从账户的 improvedUsers 列表中删除 improvedUserId
        const updateResult = await Account.deleteImprovedUser(account._id, improvedUserId);

        if (updateResult.modifiedCount === 0) {
            return res.status(404).json({ message: 'ImprovedUser ID not found in account' });
        }
        const improvedUser = await ImprovedUser.findById(improvedUserId);
        const deleteResumeHistoryResult = await ResumeHistory.deleteById(improvedUser.resumeId);
        if (deleteResumeHistoryResult.deletedCount === 0) {
            return res.status(404).json({ message: 'ResumeHistory not found' });
        }

        // 删除 improvedUser
        const deleteResult = await ImprovedUser.deleteById(improvedUserId);
        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({ message: 'ImprovedUser not found' });
        }

        res.status(200).json({ message: 'ImprovedUser deleted successfully and removed from account' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to delete improved user or update account', error: error.toString() });
    }
});


// POST请求，保存数据到相应的集合
// 更新个人信息数据
router.post('/save-data', async (req, res) => {
    const { id, type, data } = req.body;
    console.log('Request body:', req.body);
    try {
        // 根据type决定更新哪个部分
        let updatePath = {};
        switch (type) {
            case 'basicInformation':
                updatePath['基本信息'] = data;
                break;
            case 'personalEvaluation':
                updatePath['个人评价'] = data;
                break;
            case 'educationHistory':
                updatePath['教育经历'] = data;
                break;
            case 'professionalExperience':
                updatePath['职业经历'] = data;
                break;
            case 'projectExperience':
                updatePath['项目经历'] = data;
                break;
            case 'awardsAndCertificates':
                updatePath['获奖与证书'] = data;
                break;
            case 'skills':
                updatePath['技能'] = data;
                break;
            case 'languages':
                updatePath['语言'] = data;
                break;
            case 'researchPapersAndPatents':
                updatePath['科研论文与知识产权'] = data;
                break;
            default:
                return res.status(400).json({ message: "Invalid type specified" });
        }

        // 更新数据库记录
        // console.log("before send to update")
        // console.log(updatePath)
        const result = await ImprovedUser.update(id, updatePath);
        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: "No record found to update." });
        }

        // 调用 Python 脚本更新完整度
        const pythonProcess = spawn('python3', ['./pyScripts/update_complete_score.py', id]);

        pythonProcess.stdout.on('data', (data) => {
            try {
                const output = data.toString();
                const jsonOutput = JSON.parse(output);
                // console.log('Parsed JSON output:', jsonOutput);
                res.status(200).json({ resumeId: id, message: "保存成功！", completeness: jsonOutput.completeness });
            } catch (error) {
                console.error('Failed to parse JSON:', error);
                res.status(500).json({ resumeId: id, message: "保存失败！", error: error.toString() });
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

    } catch (error) {
        res.status(500).json({ resumeId: id, message: "保存失败！", error: error.toString() });
    }
});


router.post('/improved-users/generate-resume', async (req, res) => {
    const { id } = req.body;
    console.log('Generating resume for user:', id);
    const pythonProcess = spawn('python3', ['./pyScripts/generate_cv.py', id],
        {
            env: {
                ...process.env,
            }
        }
    );
    console.log('Python process spawned:', pythonProcess.pid);
    processResult[id] = { status: 'running', progress: 0 };
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`stdout: ${output}`);

        // Check if the output contains a progress message
        const progressMatch = output.match(/PROGRESS: (\d+)/);
        if (progressMatch) {
            const progressValue = parseInt(progressMatch[1], 10);
            processResult[id].progress = progressValue;
        }
    });

    pythonProcess.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        processResult[id].status = 'done';
    });

    res.status(200).json({ message: "Resume generation started" });
});

router.post('/improved-users/resume-result', (req, res) => {
    const { id } = req.body;
    const result = processResult[id];
    if (!result) {
        return res.status(404).json({ message: 'No result found' });
    }
    if (result.status === 'running') {
        return res.status(202).json({ message: 'Result is still running', progress: result.progress });
    }
    if (result.status === 'done') {
        return res.status(200).json({ message: 'Result is ready' });
    }
});

router.post('/improved-users/markdown', async (req, res) => {
    const { id } = req.body;
    try {
        const record = await ImprovedUser.findById(id);
        if (!record) {
            return res.status(404).send({ message: "User not found" });
        }
        const markdown = record.improved_cv_md;
        if (!markdown) {
            return res.status(404).send({ message: "Markdown data not found for the user" });
        }
        res.type('text/markdown').status(200).send(markdown);
    } catch (error) {
        console.error('Failed to retrieve user data:', error);
        res.status(500).send({ message: "Server error while retrieving data" });
    }
});

module.exports = router;
