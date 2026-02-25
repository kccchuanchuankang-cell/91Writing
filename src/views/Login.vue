<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <h2 class="title">AI写作登录</h2>
        <p class="subtitle">您的云端私人写作助手</p>
      </div>
      
      <el-form 
        :model="form" 
        :rules="rules" 
        ref="loginForm" 
        label-position="top"
        @keyup.enter="handleLogin"
      >
        <el-form-item label="用户名 / 账号" prop="username">
          <el-input 
            v-model="form.username" 
            placeholder="请输入账号" 
            prefix-icon="User"
            clearable
          />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="form.password" 
            type="password" 
            placeholder="请输入密码" 
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            class="submit-btn" 
            :loading="authStore.loading"
            @click="handleLogin"
          >
            {{ isRegistering ? '注册并登录' : '登 录' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div class="login-footer">
        <span class="toggle-text" @click="toggleMode">
          {{ isRegistering ? '已有账号？去登录' : '没有账号？立即注册' }}
        </span>
      </div>
    </el-card>

    <div class="copyright">
      <p>© 2026 91Writing 小说创作平台</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';

const router = useRouter();
const authStore = useAuthStore();
const loginForm = ref(null);

const isRegistering = ref(false);

const form = reactive({
  username: '',
  password: ''
});

const rules = reactive({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
  ]
});

const toggleMode = () => {
  isRegistering.value = !isRegistering.value;
  loginForm.value?.clearValidate();
};

const handleLogin = async () => {
  if (!loginForm.value) return;
  
  await loginForm.value.validate(async (valid) => {
    if (valid) {
      try {
        if (isRegistering.value) {
          // Attempt registration
          await authStore.register(form.username, form.password);
          ElMessage.success('注册成功，正在进入系统...');
        } else {
          // Attempt login
          await authStore.login(form.username, form.password);
          ElMessage.success('登录成功，欢迎回来！');
        }
        // Redirect to dashboard (HomePage)
        router.push({ name: 'HomePage' });
      } catch (error) {
        // Error message is already set in the authStore, but we can display a toast
        ElMessage.error(authStore.error || '操作失败，请重试');
      }
    }
  });
};
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.login-card {
  width: 400px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
  border: none;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.title {
  font-size: 28px;
  color: #303133;
  margin: 0 0 10px 0;
  font-weight: 600;
  letter-spacing: 1px;
}

.subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 6px;
  margin-top: 10px;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.toggle-text {
  color: #409EFF;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.3s;
}

.toggle-text:hover {
  color: #66b1ff;
  text-decoration: underline;
}

.copyright {
  margin-top: 40px;
  color: #909399;
  font-size: 13px;
}

/* 适配移动端 */
@media screen and (max-width: 480px) {
  .login-card {
    width: 90%;
    margin: 0 20px;
  }
}
</style>
