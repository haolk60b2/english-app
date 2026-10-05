export type PracticeMaterial = {
  id: string; kind: "reading" | "podcast"; level: "A1" | "A2" | "B1";
  title: string; minutes: number; goal: string;
  lines: { text: string; vi: string; start?: number; end?: number }[];
  vocabulary: { word: string; meaning: string; example: string }[];
  questions: { prompt: string; options: string[]; answer: number; explanation: string; evidenceIndex?: number }[];
  task: string;
};

// Original passages and dialogues. Audio for these is browser speech synthesis.
export const PRACTICE_MATERIALS: PracticeMaterial[] = [
  { id: "reading-morning", kind: "reading", level: "A1", title: "A small morning routine", minutes: 6, goal: "Tìm giờ và trình tự hoạt động; ôn hiện tại đơn.",
    lines: [
      { text: "My name is Linh. I live near my office. I get up at seven every morning.", vi: "Tôi tên Linh. Tôi sống gần văn phòng. Mỗi sáng tôi thức dậy lúc bảy giờ." },
      { text: "First, I drink a glass of water. Then I make breakfast. I usually eat bread and eggs.", vi: "Đầu tiên tôi uống một cốc nước. Sau đó tôi làm bữa sáng. Tôi thường ăn bánh mì và trứng." },
      { text: "I walk to work at eight. The walk takes fifteen minutes. I do not use my phone on the way.", vi: "Tôi đi bộ đến chỗ làm lúc tám giờ. Quãng đường mất mười lăm phút. Tôi không dùng điện thoại trên đường." },
      { text: "Before work, I read one short English paragraph. I do not understand every word, but I try to find the main idea.", vi: "Trước khi làm việc, tôi đọc một đoạn tiếng Anh ngắn. Tôi không hiểu mọi từ nhưng cố tìm ý chính." },
    ],
    vocabulary: [{ word: "routine", meaning: "thói quen/lịch sinh hoạt", example: "My morning routine is simple." }, { word: "on the way", meaning: "trên đường", example: "I buy coffee on the way to work." }, { word: "main idea", meaning: "ý chính", example: "Can you find the main idea?" }],
    questions: [{ prompt: "What time does Linh get up?", options: ["At seven", "At eight", "At nine"], answer: 0, explanation: "Đoạn đầu ghi get up at seven." }, { prompt: "How does Linh get to work?", options: ["By bus", "On foot", "By car"], answer: 1, explanation: "I walk to work nghĩa là đi bộ." }, { prompt: "What does Linh try to find when reading?", options: ["Every new word", "The main idea", "A phone number"], answer: 1, explanation: "Câu cuối nêu mục tiêu tìm ý chính." }], task: "Nói 3 câu về buổi sáng của bạn với First, Then và Before work." },
  { id: "reading-message", kind: "reading", level: "A2", title: "A change of plans", minutes: 7, goal: "Đọc tin nhắn, tìm thông tin thay đổi và lý do.",
    lines: [
      { text: "Hi Alex, I am sorry, but I cannot meet you at the café at six today. My train is delayed.", vi: "Chào Alex, xin lỗi, hôm nay tôi không thể gặp bạn ở quán cà phê lúc sáu giờ. Tàu của tôi bị trễ." },
      { text: "The station staff said the next train would arrive in twenty minutes. I will probably reach the city at half past six.", vi: "Nhân viên nhà ga nói chuyến tiếp theo sẽ đến sau hai mươi phút. Có lẽ tôi sẽ đến thành phố lúc sáu giờ rưỡi." },
      { text: "Could we meet at seven instead? There is a small restaurant next to the café. We could have dinner there.", vi: "Thay vào đó mình gặp lúc bảy giờ được không? Có nhà hàng nhỏ cạnh quán cà phê. Mình có thể ăn tối ở đó." },
      { text: "If that is too late, let us meet tomorrow. Please send me a message when you have time. Thanks for understanding.", vi: "Nếu quá muộn thì mình gặp ngày mai nhé. Hãy nhắn khi bạn có thời gian. Cảm ơn bạn đã thông cảm." },
    ],
    vocabulary: [{ word: "delayed", meaning: "bị trễ", example: "Our flight is delayed." }, { word: "instead", meaning: "thay vào đó", example: "Let's meet tomorrow instead." }, { word: "next to", meaning: "bên cạnh", example: "The shop is next to the station." }],
    questions: [{ prompt: "Why does the writer want to change the plan?", options: ["The café is closed", "The train is delayed", "Alex is busy"], answer: 1, explanation: "Tin nhắn ghi My train is delayed." }, { prompt: "What new meeting time does the writer suggest?", options: ["Six", "Half past six", "Seven"], answer: 2, explanation: "Giờ đề nghị gặp là seven; half past six là giờ dự kiến đến thành phố." }, { prompt: "Where is the restaurant?", options: ["Next to the café", "Inside the station", "Near Alex's house"], answer: 0, explanation: "Đoạn ba nói next to the café." }], task: "Viết tin nhắn 2 câu đổi giờ hẹn: nêu lý do và đề nghị giờ mới." },
  { id: "reading-learning", kind: "reading", level: "B1", title: "Practice you can keep doing", minutes: 8, goal: "Phân biệt vấn đề, giải pháp và ví dụ; tóm tắt bằng lời của bạn.",
    lines: [
      { text: "Minh used to save long English videos for the weekend. He wanted to finish all of them, but he often felt tired after the first video.", vi: "Minh từng lưu video tiếng Anh dài để xem cuối tuần. Anh muốn xem hết nhưng thường mệt sau video đầu tiên." },
      { text: "He decided to make his practice smaller. On Monday, he chose a short conversation about ordering lunch. He listened once without reading the transcript.", vi: "Anh quyết định chia nhỏ việc luyện tập. Thứ Hai anh chọn hội thoại ngắn về gọi bữa trưa và nghe một lượt không đọc lời thoại." },
      { text: "Next, he wrote down the words he could hear. When he checked the transcript, he noticed that he had missed several small words between the main words.", vi: "Sau đó anh ghi từ nghe được. Khi kiểm tra lời thoại, anh nhận ra đã bỏ sót vài từ nhỏ giữa các từ chính." },
      { text: "He repeated one useful sentence and changed the food in it. The next day, he used that sentence to order a sandwich. His practice had a clear purpose.", vi: "Anh lặp lại một câu hữu ích và thay tên món ăn. Hôm sau anh dùng câu đó để gọi sandwich. Việc luyện tập có mục đích rõ ràng." },
      { text: "Minh still watches longer videos when he has time. However, he now chooses a small task he can complete on a busy day, rather than waiting for a perfect free afternoon.", vi: "Minh vẫn xem video dài khi rảnh. Nhưng giờ anh chọn việc nhỏ có thể hoàn thành trong ngày bận thay vì chờ một buổi chiều thật rảnh." },
    ],
    vocabulary: [{ word: "purpose", meaning: "mục đích", example: "This exercise has a clear purpose." }, { word: "rather than", meaning: "thay vì", example: "I practise daily rather than wait for the weekend." }, { word: "notice", meaning: "nhận thấy", example: "I notice a new sound in this word." }],
    questions: [{ prompt: "What was Minh's problem at first?", options: ["He had no videos", "His plan was hard to finish", "He did not like lunch"], answer: 1, explanation: "Anh muốn xem hết video dài nhưng thường mệt sau video đầu." }, { prompt: "When did he first read the transcript?", options: ["Before listening", "After listening and writing words", "Only after ordering food"], answer: 1, explanation: "Anh nghe trước, ghi từ rồi kiểm tra lời thoại." }, { prompt: "What is the main idea?", options: ["Never watch long videos", "Wait for a free afternoon", "Choose practice you can complete and use"], answer: 2, explanation: "Bài nhấn mạnh nhiệm vụ nhỏ, có mục đích; không cấm video dài." }], task: "Tóm tắt bài trong 2 câu. Chọn một câu bạn có thể dùng hôm nay." },
  { id: "reading-feedback", kind: "reading", level: "B1", title: "Asking for clearer feedback", minutes: 8, goal: "Đọc tình huống công việc và học cách đề nghị giải thích cụ thể.",
    lines: [
      { text: "When Mai sent her first report to her manager, the reply was short: Please make the introduction clearer. She was not sure what to change.", vi: "Khi Mai gửi báo cáo đầu cho quản lý, phản hồi rất ngắn: hãy làm phần mở đầu rõ hơn. Cô chưa biết phải sửa gì." },
      { text: "Instead of rewriting the whole report immediately, she asked two questions. Which part is difficult to follow? Could you show me an example of the detail you need?", vi: "Thay vì viết lại toàn bộ ngay, cô hỏi hai câu: phần nào khó theo dõi và có thể cho ví dụ về chi tiết cần thêm không?" },
      { text: "Her manager explained that the report described the results but did not state the original goal. Mai added two sentences about the goal and moved one example to the next section.", vi: "Quản lý giải thích rằng báo cáo nêu kết quả nhưng chưa nêu mục tiêu ban đầu. Mai thêm hai câu về mục tiêu và chuyển một ví dụ sang phần tiếp theo." },
      { text: "The second version was easier to follow. Mai learned that asking a specific question can save time and make feedback easier to use.", vi: "Bản thứ hai dễ theo dõi hơn. Mai hiểu rằng hỏi cụ thể có thể tiết kiệm thời gian và giúp áp dụng phản hồi dễ hơn." },
    ],
    vocabulary: [{ word: "feedback", meaning: "phản hồi/góp ý", example: "Thank you for your feedback." }, { word: "specific", meaning: "cụ thể", example: "Could you give me a specific example?" }, { word: "report", meaning: "báo cáo", example: "I sent the report this morning." }],
    questions: [{ prompt: "What was missing from the report?", options: ["The results", "The original goal", "The manager's name"], answer: 1, explanation: "Báo cáo có kết quả nhưng thiếu mục tiêu ban đầu." }, { prompt: "What did Mai do before rewriting?", options: ["Asked specific questions", "Deleted the report", "Changed every example"], answer: 0, explanation: "Mai hỏi phần nào khó hiểu và xin ví dụ cụ thể." }, { prompt: "What does the story suggest?", options: ["Feedback is always clear", "Never ask your manager questions", "Clarify feedback before making large changes"], answer: 2, explanation: "Hỏi rõ giúp Mai sửa đúng phần cần sửa." }], task: "Đọc thành tiếng: Could you give me a specific example? Sau đó đổi example thành detail." },
  { id: "podcast-lunch", kind: "podcast", level: "A1", title: "Lunch at a small café", minutes: 7, goal: "Nghe món ăn, đồ uống và lựa chọn ăn tại chỗ hay mang đi.",
    lines: [
      { text: "Hello! What would you like for lunch?", vi: "Xin chào! Bạn muốn ăn gì cho bữa trưa?" },
      { text: "I would like a chicken sandwich, please.", vi: "Cho tôi một sandwich gà." },
      { text: "Would you like a drink with that?", vi: "Bạn có muốn dùng thêm đồ uống không?" },
      { text: "Yes, a small tea, please. No sugar.", vi: "Có, một ly trà nhỏ, không đường." },
      { text: "Of course. Would you like to eat here or take it away?", vi: "Được thôi. Bạn muốn ăn tại đây hay mang đi?" },
      { text: "I will eat here. I have a little time before work.", vi: "Tôi sẽ ăn tại đây. Tôi có chút thời gian trước khi làm việc." },
    ], vocabulary: [{ word: "take away", meaning: "mang đi", example: "Can I take this sandwich away?" }, { word: "sugar", meaning: "đường", example: "No sugar, please." }],
    questions: [{ prompt: "What does the customer order?", options: ["Chicken sandwich", "Beef soup", "Cheese pizza"], answer: 0, explanation: "Khách gọi a chicken sandwich." }, { prompt: "What is the drink?", options: ["Coffee with sugar", "A large juice", "A small tea without sugar"], answer: 2, explanation: "Khách nói a small tea và No sugar." }, { prompt: "Where will the customer eat?", options: ["At work", "At the café", "On the train"], answer: 1, explanation: "I will eat here nghĩa là ăn tại quán." }], task: "Nói một đơn gọi món của bạn: I would like …, please." },
  { id: "podcast-weekend", kind: "podcast", level: "A2", title: "A weekend with a backup plan", minutes: 8, goal: "Nghe kế hoạch và phương án nếu thời tiết thay đổi.",
    lines: [
      { text: "Do you have any plans for Saturday?", vi: "Bạn có kế hoạch gì cho thứ Bảy không?" },
      { text: "I am going to cycle to the park with my sister. We want to leave at nine.", vi: "Tôi sẽ đạp xe đến công viên cùng chị/em gái. Chúng tôi muốn đi lúc chín giờ." },
      { text: "That sounds nice. The weather might be rainy, though.", vi: "Nghe hay đấy. Tuy nhiên trời có thể mưa." },
      { text: "Yes, we checked the forecast. If it rains, we will visit the museum instead.", vi: "Đúng, chúng tôi đã xem dự báo. Nếu mưa, chúng tôi sẽ đi bảo tàng thay thế." },
      { text: "Can I join you? I have never been to that museum.", vi: "Tôi đi cùng được không? Tôi chưa đến bảo tàng đó bao giờ." },
      { text: "Of course! Let us check the weather again on Friday evening.", vi: "Được chứ! Tối thứ Sáu mình kiểm tra thời tiết lại nhé." },
    ], vocabulary: [{ word: "forecast", meaning: "dự báo", example: "The forecast says it will rain." }, { word: "join", meaning: "tham gia/đi cùng", example: "Can I join you?" }],
    questions: [{ prompt: "When do they want to leave?", options: ["At seven", "At nine", "On Friday evening"], answer: 1, explanation: "We want to leave at nine." }, { prompt: "What will they do if it rains?", options: ["Go to a museum", "Cycle anyway", "Work all day"], answer: 0, explanation: "Họ sẽ visit the museum instead." }, { prompt: "Who is going cycling with the speaker?", options: ["A colleague", "A teacher", "The speaker's sister"], answer: 2, explanation: "Người nói nhắc with my sister." }], task: "Nói một kế hoạch và phương án B: If it rains, I will …" },
  { id: "podcast-meeting", kind: "podcast", level: "B1", title: "Making a meeting useful", minutes: 8, goal: "Nghe vấn đề ở công việc và hai thay đổi được đề nghị.",
    lines: [
      { text: "Our Monday meetings often take an hour, but we leave without knowing what to do next.", vi: "Cuộc họp thứ Hai thường mất một giờ nhưng sau đó chúng ta không biết phải làm gì tiếp." },
      { text: "I agree. Could we send a short agenda before the meeting? It would help everyone prepare.", vi: "Tôi đồng ý. Mình gửi chương trình họp ngắn trước được không? Nó giúp mọi người chuẩn bị." },
      { text: "Good idea. We could also finish each topic with a clear action and the name of the person responsible.", vi: "Ý hay. Mình cũng có thể kết thúc mỗi chủ đề bằng việc cần làm rõ ràng và tên người chịu trách nhiệm." },
      { text: "Let us try that next Monday. I will write the agenda and send it on Friday afternoon.", vi: "Thử vào thứ Hai tới nhé. Tôi sẽ viết chương trình họp và gửi chiều thứ Sáu." },
      { text: "Thanks. I will take notes during the meeting and share the actions afterwards.", vi: "Cảm ơn. Tôi sẽ ghi chép trong cuộc họp và chia sẻ các việc cần làm sau đó." },
    ], vocabulary: [{ word: "agenda", meaning: "chương trình/nội dung cuộc họp", example: "Please send the agenda before the meeting." }, { word: "responsible", meaning: "chịu trách nhiệm", example: "Who is responsible for this task?" }, { word: "afterwards", meaning: "sau đó", example: "We can talk afterwards." }],
    questions: [{ prompt: "What is the problem with the meetings?", options: ["They start too early", "There are no clear next steps", "Nobody attends"], answer: 1, explanation: "Họ họp xong mà không biết việc tiếp theo." }, { prompt: "When will the agenda be sent?", options: ["Friday afternoon", "Monday evening", "During the meeting"], answer: 0, explanation: "Người nói hứa send it on Friday afternoon." }, { prompt: "What will the other speaker share afterwards?", options: ["Holiday photos", "A shopping list", "The actions"], answer: 2, explanation: "Người còn lại ghi chép và share the actions afterwards." }], task: "Luyện đề nghị: Could we …? Thay bằng một cải tiến bạn muốn tại nơi làm việc." },
  { id: "podcast-study", kind: "podcast", level: "B1", title: "Finding time for English", minutes: 8, goal: "Nghe trở ngại và xác định kế hoạch học mới.",
    lines: [
      { text: "I want to improve my English, but I only have thirty minutes a day. Is that enough to start?", vi: "Tôi muốn cải thiện tiếng Anh nhưng chỉ có ba mươi phút mỗi ngày. Đủ để bắt đầu không?" },
      { text: "It is a useful starting point. What do you need English for?", vi: "Đó là một điểm khởi đầu hữu ích. Bạn cần tiếng Anh cho việc gì?" },
      { text: "I need to explain my work to visitors and understand short conversations.", vi: "Tôi cần giải thích công việc cho khách và hiểu hội thoại ngắn." },
      { text: "Then choose short materials about your work. Listen first, check what you missed, and practise saying a useful sentence.", vi: "Vậy hãy chọn bài ngắn về công việc. Nghe trước, kiểm tra phần bỏ lỡ và luyện nói một câu hữu ích." },
      { text: "Should I learn every new word in the recording?", vi: "Tôi có nên học mọi từ mới trong bản ghi không?" },
      { text: "Start with a few words you can use. Review them tomorrow, and try to explain one real task in your own words.", vi: "Bắt đầu bằng vài từ bạn có thể dùng. Ôn ngày mai và thử giải thích một việc thật bằng lời của bạn." },
    ], vocabulary: [{ word: "explain", meaning: "giải thích", example: "Could you explain this task?" }, { word: "starting point", meaning: "điểm khởi đầu", example: "This lesson is a good starting point." }, { word: "in your own words", meaning: "bằng lời của bạn", example: "Describe it in your own words." }],
    questions: [{ prompt: "Why does the learner need English?", options: ["To explain work and understand conversations", "To write a novel", "Only to pass an exam"], answer: 0, explanation: "Người học nêu hai nhu cầu ở câu thứ ba." }, { prompt: "What should the learner do first with a recording?", options: ["Read every word", "Listen", "Memorise the transcript"], answer: 1, explanation: "Lời khuyên là Listen first." }, { prompt: "Which words should the learner start with?", options: ["Every unknown word", "Only the longest words", "A few useful words"], answer: 2, explanation: "Bắt đầu bằng a few words you can use." }], task: "Nói mục tiêu của bạn với I need English to … và một việc bạn sẽ luyện hôm nay." },
];
