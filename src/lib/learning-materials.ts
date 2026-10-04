export type Lesson = {
  id: string; category: string; title: string; minutes: number; intro: string;
  notes: string[]; samples: { text: string; note: string }[];
  exercise: string; choices: string[]; answer: string; explanation: string;
  source: { title: string; url: string };
};
const pronunciationSource = { title: "British Council · Hướng dẫn luyện phát âm", url: "https://learnenglish.britishcouncil.org/comment/192336" };
const skillsSource = { title: "British Council · Học ở trình độ B1", url: "https://learnenglish.britishcouncil.org/english-levels/improve-your-english-level/how-get-your-english-b1-level" };

export const LESSONS: Lesson[] = [
  {
    id: "ipa-vowels", category: "Phát âm", title: "IPA và cặp âm /ɪ/ – /iː/", minutes: 5,
    intro: "Chữ viết không cho biết đầy đủ cách đọc. Dùng IPA cùng âm mẫu để học âm của từng từ.",
    notes: ["/ɪ/ trong ship và /iː/ trong sheep khác cả chất lượng nguyên âm, không chỉ dài hay ngắn.", "Nghe từng từ, nói lại, rồi thử xen kẽ hai từ. Tránh đọc cả hai như cùng một âm tiếng Việt.", "IPA có thể khác giữa giọng Anh và Mỹ. Chọn một giọng mẫu để luyện nhất quán."],
    samples: [{ text: "ship", note: "/ʃɪp/ · tàu" }, { text: "sheep", note: "/ʃiːp/ · cừu" }, { text: "sit", note: "/sɪt/ · ngồi" }, { text: "seat", note: "/siːt/ · chỗ ngồi" }],
    exercise: "Từ nào có nguyên âm /iː/?", choices: ["ship", "sheep"], answer: "sheep", explanation: "sheep có /iː/, còn ship có /ɪ/. Hãy nghe cả hai và đọc lại.",
    source: { title: "British Council · Sounds Right / bảng âm", url: "https://learnenglish.britishcouncil.org/apps/learnenglish-sounds-right" },
  },
  {
    id: "th", category: "Phát âm", title: "Hai âm th: /θ/ và /ð/", minutes: 5,
    intro: "Cùng viết th nhưng think và this bắt đầu bằng hai âm khác nhau.",
    notes: ["Đặt đầu lưỡi nhẹ giữa hai hàm răng và cho hơi đi qua; không cắn chặt lưỡi.", "/θ/ trong think không rung dây thanh. /ð/ trong this có rung; đặt tay lên cổ để cảm nhận.", "Tập từ riêng trước, sau đó đọc một câu ngắn. Tránh tự thay âm th bằng t hoặc d."],
    samples: [{ text: "think", note: "/θɪŋk/" }, { text: "this", note: "/ðɪs/" }, { text: "I think this is useful.", note: "Luyện cả hai âm trong một câu" }],
    exercise: "Từ nào có âm th hữu thanh /ð/?", choices: ["think", "this"], answer: "this", explanation: "this bắt đầu bằng /ð/. think bắt đầu bằng /θ/.", source: pronunciationSource,
  },
  {
    id: "word-stress", category: "Phát âm", title: "Trọng âm: đọc rõ âm tiết chính", minutes: 4,
    intro: "Một từ nhiều âm tiết thường có một âm tiết được nhấn rõ hơn. Đọc đều tất cả âm tiết dễ làm từ khó nhận ra.",
    notes: ["Dấu ˈ trong IPA đứng ngay trước âm tiết mang trọng âm chính: about /əˈbaʊt/ nhấn âm tiết thứ hai.", "Gõ nhịp tay ở âm tiết được nhấn. Nghe rồi bắt chước độ nổi bật của âm tiết đó.", "Không có một quy tắc đúng cho mọi từ. Khi gặp từ mới, tra IPA và nghe mẫu."],
    samples: [{ text: "about", note: "a-BOUT" }, { text: "important", note: "im-POR-tant" }, { text: "English", note: "EN-glish" }],
    exercise: "about /əˈbaʊt/ nhấn âm tiết nào?", choices: ["Âm tiết đầu", "Âm tiết thứ hai"], answer: "Âm tiết thứ hai", explanation: "Dấu ˈ đứng trước /baʊt/, tức âm tiết thứ hai.",
    source: { title: "BBC Learning English · Bài luyện trọng âm", url: "https://downloads.bbc.co.uk/learningenglish/LiveEnglishClassWorksheet/260312_take_an_english_class_with_George_pronunciation_stress.pdf" },
  },
  {
    id: "ed-endings", category: "Phát âm", title: "Đuôi -ed: /t/, /d/ hay /ɪd/?", minutes: 5,
    intro: "Với động từ có quy tắc ở quá khứ, -ed không phải lúc nào cũng tạo thêm một âm tiết.",
    notes: ["Sau âm /t/ hoặc /d/: đọc /ɪd/, như wanted và needed.", "Sau âm vô thanh /p, k, f, s, ʃ, tʃ/: đọc /t/, như worked và watched.", "Sau các âm còn lại: thường đọc /d/, như played. Xét âm cuối, không chỉ chữ cái cuối. Một số tính từ có cách đọc riêng."],
    samples: [{ text: "worked", note: "-ed đọc /t/" }, { text: "played", note: "-ed đọc /d/" }, { text: "wanted", note: "-ed đọc /ɪd/" }],
    exercise: "-ed trong wanted đọc thế nào?", choices: ["/t/", "/d/", "/ɪd/"], answer: "/ɪd/", explanation: "want kết thúc bằng âm /t/, nên wanted có đuôi /ɪd/.",
    source: { title: "British Council · Past simple: regular verbs", url: "https://learnenglishteens.britishcouncil.org/grammar/a1-a2-grammar/past-simple-regular-verbs?page=1" },
  },
  {
    id: "connected-speech", category: "Phát âm", title: "Âm cuối và nối âm trong câu", minutes: 5,
    intro: "Trong lời nói tự nhiên, các từ không luôn được đọc tách rời như trong từ điển.",
    notes: ["Luyện giữ âm cuối của từ. Đừng tự thêm một nguyên âm sau phụ âm cuối.", "Khi phụ âm cuối đứng trước nguyên âm đầu, hai từ có thể nối liền, như an apple.", "Nghe một câu ngắn, đánh dấu chỗ nối, rồi đọc theo nhịp. Mục tiêu là dễ hiểu, không phải nói càng nhanh càng tốt."],
    samples: [{ text: "an apple", note: "Nghe cách nối giữa hai từ" }, { text: "pick it up", note: "Giữ phụ âm và luyện theo cụm" }, { text: "Could you help me?", note: "Luyện cả cụm thay vì đọc từng chữ" }],
    exercise: "Cách luyện nào phù hợp hơn?", choices: ["Nói thật nhanh ngay từ đầu", "Nghe câu ngắn, đọc chậm rồi tăng tốc"], answer: "Nghe câu ngắn, đọc chậm rồi tăng tốc", explanation: "Giữ âm và nhịp rõ trước khi tăng tốc.",
    source: { title: "British Council · Connected speech", url: "https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/c/connected-speech" },
  },
  {
    id: "present", category: "Ngữ pháp", title: "Hiện tại đơn và hiện tại tiếp diễn", minutes: 5,
    intro: "Phân biệt thói quen với hành động đang diễn ra để nói về ngày của bạn.",
    notes: ["Thói quen: I study every evening. Với he/she/it, động từ thường thêm -s/-es.", "Đang diễn ra: I am studying now. Cấu trúc: am/is/are + V-ing.", "Một số động từ chỉ trạng thái như know thường dùng dạng đơn: I know the answer."],
    samples: [{ text: "I practise English every day.", note: "Thói quen" }, { text: "I am practising English right now.", note: "Đang diễn ra" }],
    exercise: "Chọn câu nói về hành động đang diễn ra ngay lúc này.", choices: ["I study every day.", "I am studying now."], answer: "I am studying now.", explanation: "am + studying diễn tả hành động đang diễn ra.",
    source: { title: "British Council · Present continuous", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/present-continuous" },
  },
  {
    id: "past", category: "Ngữ pháp", title: "Kể chuyện hôm qua bằng quá khứ đơn", minutes: 5,
    intro: "Bắt đầu bằng một hoạt động đã kết thúc: hôm qua bạn làm gì?",
    notes: ["Khẳng định: I worked yesterday. Động từ bất quy tắc cần học riêng, ví dụ go → went.", "Phủ định: I did not work yesterday. Sau did/didn't dùng động từ nguyên mẫu.", "Câu hỏi: Did you work yesterday? Không dùng Did you worked…"],
    samples: [{ text: "I visited a friend yesterday.", note: "Động từ có quy tắc" }, { text: "I went shopping last Sunday.", note: "go → went" }, { text: "Did you study yesterday?", note: "did + động từ nguyên mẫu" }],
    exercise: "Câu nào đúng?", choices: ["Did you went shopping?", "Did you go shopping?"], answer: "Did you go shopping?", explanation: "Sau did, dùng go thay vì went.",
    source: { title: "British Council · Past simple", url: "https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-simple?hc_location=ufi&page=1" },
  },
  {
    id: "chunks", category: "Từ vựng", title: "Học cụm từ và một câu của riêng bạn", minutes: 4,
    intro: "Ghi lại cả cụm thường dùng để dễ đem từ mới vào lời nói.",
    notes: ["Ví dụ: learn a skill, make a plan, meet a deadline. Học cùng câu để biết cách dùng.", "Với mỗi từ mới, viết một câu đúng với cuộc sống của bạn.", "Ngày hôm sau, che câu mẫu và tự nói lại ý của mình trước khi xem đáp án."],
    samples: [{ text: "I want to learn a new skill.", note: "learn a skill" }, { text: "Let's make a plan for tomorrow.", note: "make a plan" }, { text: "I need to meet the deadline.", note: "meet a deadline" }],
    exercise: "Cụm tự nhiên để nói lập kế hoạch là gì?", choices: ["make a plan", "do a plan"], answer: "make a plan", explanation: "Trong nghĩa lập kế hoạch, dùng make a plan.", source: skillsSource,
  },
  {
    id: "listening", category: "Nghe", title: "Nghe ba lượt, không mở lời thoại ngay", minutes: 5,
    intro: "Dùng một đoạn ngắn vừa sức, khoảng 20–40 giây, để luyện nghe có mục tiêu.",
    notes: ["Lượt 1: nghe ý chính, không dừng ở mọi từ lạ.", "Lượt 2: nghe lại và ghi 3 từ khóa. Lượt 3: xem lời thoại, tìm chỗ mình nghe nhầm.", "Chọn một câu để bắt chước. Không cần hiểu 100% mới được chuyển sang đoạn khác."],
    samples: [{ text: "I usually study after dinner, but today I have an early meeting. I will practise English during my lunch break.", note: "Nghe mẫu, che nội dung và ghi thời điểm người nói sẽ học" }],
    exercise: "Trong đoạn mẫu, hôm nay người nói sẽ học lúc nào?", choices: ["During the lunch break", "After dinner"], answer: "During the lunch break", explanation: "Hôm nay có cuộc họp sớm, nên người nói sẽ luyện trong giờ nghỉ trưa.", source: skillsSource,
  },
  {
    id: "speaking", category: "Nói", title: "Shadowing và nói 30 giây về bản thân", minutes: 5,
    intro: "Kết hợp bắt chước câu mẫu với tự diễn đạt, để không chỉ đọc thuộc.",
    notes: ["Nghe một câu. Dừng audio, đọc lại. Sau khi quen mới thử nói gần đồng thời với mẫu.", "Thay một chi tiết bằng thông tin của bạn: nghề nghiệp, giờ học, sở thích.", "Ghi âm 30 giây, nghe lại và chọn một điểm cần sửa ở lượt sau."],
    samples: [{ text: "I work during the day and study English in the evening.", note: "Thay bằng lịch thật của bạn" }, { text: "My goal is to speak more confidently at work.", note: "Nói về mục tiêu của bạn" }],
    exercise: "Sau khi đọc theo mẫu, bạn nên làm gì?", choices: ["Tự nói một câu phù hợp với mình", "Chỉ học thuộc âm thanh"], answer: "Tự nói một câu phù hợp với mình", explanation: "Tự diễn đạt giúp bạn luyện sử dụng từ, thay vì chỉ lặp lại mẫu.", source: skillsSource,
  },
  {
    id: "writing", category: "Viết", title: "Nhật ký 3 câu và tự sửa một lỗi", minutes: 5,
    intro: "Viết ít nhưng cụ thể: chuyện đã xảy ra, cảm nhận của bạn, và kế hoạch tiếp theo.",
    notes: ["Câu 1: hôm nay bạn làm gì? Câu 2: điều gì thú vị hoặc khó? Câu 3: ngày mai bạn muốn làm gì?", "Kiểm tra chủ ngữ, động từ và thì trước. Đừng chỉ chăm chút từ khó.", "Sau khi được góp ý, viết lại câu sai mà không nhìn bản sửa."],
    samples: [{ text: "Today I learned eight new words.", note: "Việc đã làm" }, { text: "Pronunciation was challenging, but I kept practising.", note: "Cảm nhận" }, { text: "Tomorrow I will review these words.", note: "Kế hoạch" }],
    exercise: "Câu nào đúng khi kể việc đã làm hôm qua?", choices: ["Yesterday I learn new words.", "Yesterday I learned new words."], answer: "Yesterday I learned new words.", explanation: "Dùng learned cho hành động đã kết thúc trong quá khứ.", source: skillsSource,
  },
];
