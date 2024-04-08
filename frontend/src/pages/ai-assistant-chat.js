"use client"
import { useState, useRef, useEffect } from 'react'
import Navbar from '../components/navbar'
import ChatSegment from '../components/chat'

const avatar = <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-user-circle w-12 h-12" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
  <path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
</svg>

const initialMessages = [{
  text: "[xxx]你好，我是你的简历规划师[xxx]，在帮助你制作一份[应届生求职]简历之前，我需要了解你的一些个人基本信息和过往学习实习经历，对话可以随时开始或暂停，你的资料会被妥善保存，仅用于简历制作。",
  sender: "bot"
}, {
  text: "此次交流仅作为初步信息搜集，如有遗漏不用担心，你可以随时告诉我们，我们将为你修改并补充。",
  sender: "bot"
}, {
  text: "首先，可以告诉我你的中文姓名和英文名吗？",
  sender: "bot"
}]

const AIChat = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showLeaveBtn, setShowLeaveBtn] = useState(false);
  const [chatId, setChatId] = useState(null);

  useEffect(() => {
    const sendInitialMessages = () => {
      setLoading(true);
      initialMessages.forEach((message, index) => {
        setTimeout(() => {
          setChatHistory(prev => [...prev, message]);
          if (index === initialMessages.length - 1) {
            setLoading(false);
          }
        }, 1000 * (index + 1));
      });
    }
    sendInitialMessages();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLeaveBtn(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);


  const textInputRef = useRef(null);
  const sendMessage = async (event) => {
    event.preventDefault();

    const message = textInputRef.current.value;
    if (message.trim().length > 0) {
      setLoading(true);
      const question = chatHistory[chatHistory.length - 1].text;
      const newChat = {
        id: chatHistory.length + 1,
        text: message,
        sender: 'user',
      }
      setChatHistory([...chatHistory, newChat]);
      textInputRef.current.value = '';
      if (chatId) {
        const response = await fetch('http://localhost:8000/api/resume-chat/' + chatId, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            question: question,
            answer: message
          })
        });
        if (response.ok) {
          const newQues = {
            type: "choice",
            text: "testtesttest",
            sender: "bot"
          };
          setChatHistory([...chatHistory, newQues]);
        } else {
          console.error('Failed to save chat');
          alert('Server error');
        }
      } else {
        const response = await fetch('http://localhost:8000/api/resume-chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userAccount: 'test',
            messages: [{
              question: question,
              answer: message
            }]
          })
        });
        if (response.ok) {
          const data = await response.json();
          setChatId(data._id);
          const newQues = {
            type: "choice",
            text: "testtesttest",
            sender: "bot"
          };
          setChatHistory([...chatHistory, newQues]);
        } else {
          console.error('Failed to save chat');
          alert('Server error');
        }
      }
    }
    setLoading(false);
  };


  const handleKeyUp = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMessage(event);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
    }
  };

  return (
    <div className="bg-[#EDF8FD] w-full h-screen">
      <Navbar />
      <div className='w-full max-w-[960px] mx-auto flex flex-col justify-center items-stretch gap-y-4 p-4 overflow-x-hidden overflow-y-auto'>
        <h1 className="font-semibold text-2xl text-[#1D80A7] text-center">
          简历信息收集
        </h1>
        <ul>
          {chatHistory.map((chat, index) => (
            <li key={index} className={`flex items-center text-black justify-start gap-x-4 ${chat.sender === 'bot' ? "flex-row" : "flex-row-reverse"}`}>
              {avatar}
              <ChatSegment sender={chat.sender} chatMessage={chat.text} />
            </li>
          ))}
        </ul>
      </div>
      <div className='fixed inset-x-0 bottom-0 p-2 flex justify-center items-center flex-row gap-x-4 w-full max-w-[864px] mx-auto mb-6 border border-solid border-[#1D80A7] rounded-lg bg-white shadow-lg'>
        <input type="text" className='w-full p-1 focus:outline-none' placeholder={loading ? "请稍等……" : '请输入您的回答'} ref={textInputRef} onKeyUp={handleKeyUp} onKeyDown={handleKeyDown} disabled={loading} />
        {loading ?
          <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-dots animate-pulse w-6 h-6 text-gray-400 hover:cursor-wait" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M5 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
            <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
            <path d="M19 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
          </svg> :
          <svg xmlns="http://www.w3.org/2000/svg" className="icon icon-tabler icon-tabler-send-2 w-6 h-6 text-black hover:cursor-pointer" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" onClick={sendMessage}>
            <path stroke="none" d="M0 0h24v24H0z" fill="none" />
            <path d="M4.698 4.034l16.302 7.966l-16.302 7.966a.503 .503 0 0 1 -.546 -.124a.555 .555 0 0 1 -.12 -.568l2.468 -7.274l-2.468 -7.274a.555 .555 0 0 1 .12 -.568a.503 .503 0 0 1 .546 -.124z" />
            <path d="M6.5 12h14.5" />
          </svg>
        }
      </div>
    </div>
  )
}

export default AIChat;